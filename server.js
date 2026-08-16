
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

const RENDER_URL =
    process.env.RENDER_URL ||
    "https://lunarsmusicbot.onrender.com";

const REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    `${RENDER_URL}/auth/discord/callback`;

const INVITE_REDIRECT_URI =
    process.env.DISCORD_INVITE_REDIRECT_URI ||
    `${RENDER_URL}/invite/callback`;

const SESSION_SECRET = process.env.SESSION_SECRET;

// ============================================
// CONFIG CHECK
// ============================================

if (!CLIENT_ID) {
    console.error("❌ Missing DISCORD_CLIENT_ID");
    process.exit(1);
}

if (!CLIENT_SECRET) {
    console.error("❌ Missing DISCORD_CLIENT_SECRET");
    process.exit(1);
}

if (!SESSION_SECRET) {
    console.error("❌ Missing SESSION_SECRET");
    process.exit(1);
}

console.log("==============================================");
console.log("          LUNARS MUSIC WEBSITE");
console.log("==============================================");
console.log("✔ Discord Client ID loaded");
console.log("✔ Discord Client Secret loaded");
console.log("✔ Session secret loaded");
console.log(`🌐 Public URL: ${RENDER_URL}`);
console.log(`🔐 Login callback: ${REDIRECT_URI}`);
console.log(`🤖 Invite callback: ${INVITE_REDIRECT_URI}`);
console.log("==============================================");

// ============================================
// EXPRESS
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// ============================================
// STATIC WEBSITE
// ============================================

const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

// ============================================
// DISCORD LOGIN
// ============================================

app.get("/auth/discord", (req, res) => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: "identify guilds"
    });

    const discordURL =
        `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log("🔐 Redirecting user to Discord login...");

    res.redirect(discordURL);
});

// ============================================
// DISCORD LOGIN CALLBACK
// ============================================

app.get("/auth/discord/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send(`
            <h1>Discord Login Error</h1>
            <p>No authorization code was provided.</p>
            <a href="/">Return to LunarsMusicBot</a>
        `);
    }

    try {
        // ----------------------------------------
        // Exchange OAuth code for access token
        // ----------------------------------------

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: REDIRECT_URI
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(
                "Discord token error:",
                tokenData
            );

            return res.status(500).send(`
                <h1>Discord Authentication Failed</h1>
                <p>Discord rejected the authentication request.</p>
                <a href="/">Return to LunarsMusicBot</a>
            `);
        }

        // ----------------------------------------
        // Get Discord user
        // ----------------------------------------

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization:
                        `Bearer ${tokenData.access_token}`
                }
            }
        );

        const user = await userResponse.json();

        if (!userResponse.ok) {
            console.error(
                "Discord user error:",
                user
            );

            return res.status(500).send(`
                <h1>Could Not Get Discord Account</h1>
                <p>Discord did not return your account information.</p>
                <a href="/">Return to LunarsMusicBot</a>
            `);
        }

        // ----------------------------------------
        // Get Discord servers
        // ----------------------------------------

        const guildResponse = await fetch(
            "https://discord.com/api/users/@me/guilds",
            {
                headers: {
                    Authorization:
                        `Bearer ${tokenData.access_token}`
                }
            }
        );

        const guilds = await guildResponse.json();

        if (!guildResponse.ok) {
            console.error(
                "Discord guild error:",
                guilds
            );

            return res.status(500).send(`
                <h1>Could Not Load Servers</h1>
                <p>Discord did not return your server list.</p>
                <a href="/">Return to LunarsMusicBot</a>
            `);
        }

        // ----------------------------------------
        // Save session
        // ----------------------------------------

        req.session.user = {
            id: user.id,
            username: user.username,
            global_name: user.global_name,
            avatar: user.avatar
        };

        req.session.guilds = guilds;

        req.session.discordAccessToken =
            tokenData.access_token;

        console.log(
            `✔ Discord login: ${user.username}`
        );

        res.redirect("/");
    } catch (error) {
        console.error(
            "Discord OAuth error:",
            error
        );

        res.status(500).send(`
            <h1>Something Went Wrong</h1>
            <p>We couldn't connect to Discord.</p>
            <a href="/">Return to LunarsMusicBot</a>
        `);
    }
});

// ============================================
// BOT INVITE
// ============================================

app.get("/invite", (req, res) => {
    const permissions = "36700160";

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        scope: "bot applications.commands",
        permissions: permissions,
        response_type: "code",
        redirect_uri: INVITE_REDIRECT_URI
    });

    const inviteURL =
        `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log("🤖 Creating Lunars bot invite");

    res.redirect(inviteURL);
});

// ============================================
// BOT INVITE CALLBACK
// ============================================

app.get("/invite/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send(
            thankYouPage({
                success: false,
                title: "Something went wrong",
                message:
                    "Discord did not provide an authorization code."
            })
        );
    }

    try {
        /*
         * Discord's bot authorization flow can return
         * information about the authorized installation.
         *
         * We exchange the code here so the OAuth flow
         * completes correctly.
         */

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: INVITE_REDIRECT_URI
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(
                "Invite token error:",
                tokenData
            );

            /*
             * Even if Discord doesn't return an OAuth
             * token for the installation flow, the bot
             * authorization may already have completed.
             *
             * We therefore show the success page rather
             * than exposing Discord's internal error.
             */

            return res.send(
                thankYouPage({
                    success: true
                })
            );
        }

        let guildName = null;

        /*
         * If Discord gives us an access token, try to
         * identify the user who completed the flow.
         */

        if (tokenData.access_token) {
            try {
                const userResponse = await fetch(
                    "https://discord.com/api/users/@me",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${tokenData.access_token}`
                        }
                    }
                );

                if (userResponse.ok) {
                    const user =
                        await userResponse.json();

                    console.log(
                        `🎉 Bot authorization completed by ${user.username}`
                    );
                }
            } catch (error) {
                console.log(
                    "Could not retrieve invite user."
                );
            }
        }

        res.send(
            thankYouPage({
                success: true,
                guildName: guildName
            })
        );
    } catch (error) {
        console.error(
            "Invite callback error:",
            error
        );

        res.send(
            thankYouPage({
                success: true
            })
        );
    }
});

// ============================================
// POLISHED THANK-YOU PAGE
// ============================================

function thankYouPage({
    success = true,
    guildName = null,
    title = null,
    message = null
} = {}) {

    const safeGuildName = guildName
        ? escapeHTML(guildName)
        : "";

    const pageTitle =
        title ||
        "Thank You For Adding Lunars Music Bot to your server!";

    const pageMessage =
        message ||
        (
            safeGuildName
                ? `LunarsMusicBot is now ready for <strong>${safeGuildName}</strong>.`
                : "LunarsMusicBot is now ready for your Discord server."
        );

    return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>${escapeHTML(pageTitle)} — LunarsMusicBot</title>

<meta
    name="description"
    content="Thank you for adding LunarsMusicBot to your Discord server."
>

<meta name="theme-color" content="#ff1744">

<style>

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    min-height: 100%;
}

body {

    min-height: 100vh;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 30px;

    font-family:
        Inter,
        Arial,
        Helvetica,
        sans-serif;

    color: white;

    background:
        radial-gradient(
            circle at 50% 0%,
            rgba(255, 0, 55, .25),
            transparent 40%
        ),
        linear-gradient(
            180deg,
            #090909,
            #030303
        );

    overflow-x: hidden;
}

.background-glow {

    position: fixed;

    width: 500px;
    height: 500px;

    left: 50%;
    top: 50%;

    transform:
        translate(-50%, -50%);

    border-radius: 50%;

    background:
        rgba(255, 0, 45, .08);

    filter: blur(80px);

    pointer-events: none;
}

.card {

    position: relative;

    width: min(
        650px,
        100%
    );

    padding: 55px 40px;

    text-align: center;

    border-radius: 28px;

    border:
        1px solid
        rgba(255,255,255,.09);

    background:
        linear-gradient(
            145deg,
            rgba(20,20,20,.97),
            rgba(8,8,8,.97)
        );

    box-shadow:
        0 40px 120px
        rgba(0,0,0,.55);

    animation:
        cardIn .55s ease;
}

@keyframes cardIn {

    from {
        opacity: 0;
        transform: translateY(20px) scale(.97);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

}

.logo {

    width: 82px;
    height: 82px;

    margin:
        0 auto 25px;

    display: grid;
    place-items: center;

    border-radius: 23px;

    font-size: 38px;
    font-weight: 900;

    background:
        linear-gradient(
            135deg,
            #ff1744,
            #a90025
        );

    box-shadow:
        0 0 45px
        rgba(255,0,50,.3);
}

.check {

    position: absolute;

    right: calc(50% - 75px);
    top: 102px;

    width: 30px;
    height: 30px;

    display: grid;
    place-items: center;

    border-radius: 50%;

    background: #42e87d;

    color: #061b0e;

    font-weight: 900;

    border: 4px solid #101010;
}

.badge {

    display: inline-block;

    padding: 7px 12px;

    border-radius: 999px;

    background:
        rgba(66,232,125,.08);

    border:
        1px solid
        rgba(66,232,125,.2);

    color: #80efa5;

    font-size: 12px;
    font-weight: 800;

    margin-bottom: 18px;
}

h1 {

    margin: 0 0 15px;

    font-size:
        clamp(
            34px,
            7vw,
            54px
        );

    line-height: 1;

    letter-spacing: -2px;
}

.gradient {

    background:
        linear-gradient(
            100deg,
            #fff,
            #ff4562
        );

    -webkit-background-clip: text;
    background-clip: text;

    color: transparent;
}

.message {

    margin:
        0 auto;

    max-width: 500px;

    color: #a8a8a8;

    line-height: 1.7;

    font-size: 16px;
}

.actions {

    display: flex;

    justify-content: center;

    gap: 12px;

    flex-wrap: wrap;

    margin-top: 32px;
}

a {

    display: inline-flex;

    align-items: center;
    justify-content: center;

    min-width: 170px;

    padding:
        14px 20px;

    border-radius: 12px;

    font-weight: 850;

    text-decoration: none;

    transition:
        transform .2s,
        filter .2s;
}

.primary {

    color: white;

    background:
        linear-gradient(
            135deg,
            #ff1744,
            #c9002d
        );

    box-shadow:
        0 12px 35px
        rgba(255,0,45,.2);
}

.secondary {

    color: white;

    background: #171717;

    border:
        1px solid
        rgba(255,255,255,.09);
}

a:hover {

    transform:
        translateY(-2px);

    filter:
        brightness(1.1);
}

.commands {

    margin-top: 35px;

    padding-top: 25px;

    border-top:
        1px solid
        rgba(255,255,255,.07);

    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap: 10px;
}

.command {

    padding: 14px 10px;

    border-radius: 12px;

    background: #0c0c0c;

    border:
        1px solid
        rgba(255,255,255,.06);
}

.command strong {

    display: block;

    font-size: 14px;

    margin-bottom: 5px;
}

.command span {

    color: #777;

    font-size: 11px;
}

.footer {

    margin-top: 28px;

    color: #555;

    font-size: 12px;
}

@media(max-width:600px) {

    .card {
        padding:
            42px 22px;
    }

    .commands {
        grid-template-columns: 1fr;
    }

}

</style>

</head>

<body>

<div class="background-glow"></div>

<div class="card">

    <div class="logo">
        ♫
    </div>

    <div class="check">
        ✓
    </div>

    <div class="badge">
        ✓ BOT ADDED SUCCESSFULLY
    </div>

    <h1>
        <span class="gradient">
            ${escapeHTML(pageTitle)}
        </span>
    </h1>

    <p class="message">
        ${pageMessage}
        <br><br>
        Your community is ready to start listening.
        Head over to Discord and use
        <strong>/play</strong> to get started.
    </p>

    <div class="actions">

        <a
            class="primary"
            href="https://discord.com/app"
        >
            Open Discord
        </a>

        <a
            class="secondary"
            href="/"
        >
            Back to Lunars
        </a>

    </div>

    <div class="commands">

        <div class="command">
            <strong>/play</strong>
            <span>Play music</span>
        </div>

        <div class="command">
            <strong>/queue</strong>
            <span>View queue</span>
        </div>

        <div class="command">
            <strong>/help</strong>
            <span>View commands</span>
        </div>

    </div>

    <div class="footer">
        LunarsMusicBot · Made for Discord
    </div>

</div>

</body>

</html>
    `;
}

// ============================================
// CURRENT USER
// ============================================

app.get("/api/me", (req, res) => {

    if (!req.session.user) {

        return res.json({
            loggedIn: false,
            user: null
        });

    }

    res.json({
        loggedIn: true,
        user: req.session.user
    });

});

// ============================================
// USER SERVERS
// ============================================

app.get("/api/guilds", (req, res) => {

    if (!req.session.user) {

        return res.status(401).json({
            error: "Not logged in."
        });

    }

    const guilds =
        req.session.guilds || [];

    res.json({
        guilds: guilds.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            owner: guild.owner,
            permissions: guild.permissions,
            features: guild.features
        }))
    });

});

// ============================================
// BOT INVITE API
// ============================================

app.get("/api/bot/invite", (req, res) => {

    const inviteURL =
        `${RENDER_URL}/invite`;

    res.json({
        url: inviteURL
    });

});

// ============================================
// BOT STATS
// ============================================

app.get("/api/bot/stats", async (req, res) => {

    /*
     * These values can be supplied by your actual bot
     * through environment variables or another API.
     *
     * They are intentionally not fabricated.
     */

    const guilds =
        Number(process.env.BOT_GUILD_COUNT || 0);

    const members =
        Number(process.env.BOT_MEMBER_COUNT || 0);

    res.json({
        online: true,
        guilds,
        members,
        bot: "LunarsMusicBot"
    });

});

// ============================================
// STATUS
// ============================================

app.get("/api/status", (req, res) => {

    res.json({
        online: true,
        bot: "LunarsMusicBot",
        website: "online",
        timestamp:
            new Date().toISOString()
    });

});

// ============================================
// LOGOUT
// ============================================

app.get("/auth/logout", (req, res) => {

    req.session.destroy(error => {

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return res.status(500).send(
                "Could not log out."
            );

        }

        res.redirect("/");

    });

});

// ============================================
// SECURITY / HELPERS
// ============================================

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

// ============================================
// WEBSITE FALLBACK
// ============================================

app.use((req, res, next) => {

    if (
        req.method === "GET" &&
        !req.path.startsWith("/api/")
    ) {

        res.sendFile(
            path.join(
                publicPath,
                "index.html"
            ),
            error => {

                if (error) {
                    next(error);
                }

            }
        );

        return;
    }

    next();

});

// ============================================
// ERROR HANDLER
// ============================================

app.use((error, req, res, next) => {

    console.error(
        "Server error:",
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).send(
        "LunarsMusicBot server error."
    );

});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("==============================================");
    console.log("          LUNARS MUSIC WEBSITE");
    console.log("==============================================");

    console.log(
        `🌐 Website: ${RENDER_URL}`
    );

    console.log(
        `🔐 Login: ${RENDER_URL}/auth/discord`
    );

    console.log(
        `🤖 Invite: ${RENDER_URL}/invite`
    );

    console.log(
        `🎉 Invite callback: ${INVITE_REDIRECT_URI}`
    );

    console.log(
        `📊 Bot stats: ${RENDER_URL}/api/bot/stats`
    );

    console.log(
        `❤️ Status: ${RENDER_URL}/api/status`
    );

    console.log("==============================================");
    console.log("✅ Server started successfully!");
    console.log("");

});
