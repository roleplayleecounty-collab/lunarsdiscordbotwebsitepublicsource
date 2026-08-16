require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// =====================================================
// CONFIG
// =====================================================

const CLIENT_ID =
    process.env.DISCORD_CLIENT_ID ||
    "1535562865610850314";

const CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET;

const SESSION_SECRET =
    process.env.SESSION_SECRET;

const PUBLIC_URL =
    process.env.RENDER_URL ||
    "https://lunarsmusicbot.onrender.com";

const LOGIN_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    `${PUBLIC_URL}/auth/discord/callback`;

// =====================================================
// CONFIG CHECK
// =====================================================

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

console.log("");
console.log("==============================================");
console.log("          LUNARS MUSIC WEBSITE");
console.log("==============================================");
console.log("✔ Discord Client ID loaded");
console.log("✔ Discord Client Secret loaded");
console.log("✔ Session secret loaded");
console.log(`🌐 Public URL: ${PUBLIC_URL}`);
console.log(`🔐 Login: ${PUBLIC_URL}/auth/discord`);
console.log(`🤖 Invite: ${PUBLIC_URL}/invite`);
console.log(`📊 Bot stats: ${PUBLIC_URL}/api/bot/stats`);
console.log(`❤️ Status: ${PUBLIC_URL}/api/status`);
console.log("==============================================");
console.log("");

// =====================================================
// EXPRESS
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

// =====================================================
// SESSION
// =====================================================

app.use(
    session({
        secret: SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV === "production",

            sameSite: "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7
        }
    })
);

// =====================================================
// STATIC WEBSITE
// =====================================================

const publicPath =
    path.join(__dirname, "public");

app.use(
    express.static(publicPath)
);

// =====================================================
// DISCORD LOGIN
// =====================================================

app.get("/auth/discord", (req, res) => {

    const params =
        new URLSearchParams({
            client_id: CLIENT_ID,

            redirect_uri:
                LOGIN_REDIRECT_URI,

            response_type: "code",

            scope:
                "identify guilds"
        });

    const discordURL =
        `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log(
        "🔐 Sending user to Discord login..."
    );

    res.redirect(discordURL);
});

// =====================================================
// DISCORD LOGIN CALLBACK
// =====================================================

app.get(
    "/auth/discord/callback",
    async (req, res) => {

        const { code } = req.query;

        if (!code) {

            return res.status(400).send(`
                <html>
                <body style="
                    background:#080808;
                    color:white;
                    font-family:Arial;
                    text-align:center;
                    padding:80px;
                ">
                    <h1>Discord Login Failed</h1>
                    <p>No authorization code was provided.</p>
                    <a href="/" style="color:#ff1744">
                        Return to Lunars
                    </a>
                </body>
                </html>
            `);
        }

        try {

            // -----------------------------------------
            // Exchange code for access token
            // -----------------------------------------

            const tokenResponse =
                await fetch(
                    "https://discord.com/api/oauth2/token",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        },

                        body:
                            new URLSearchParams({
                                client_id:
                                    CLIENT_ID,

                                client_secret:
                                    CLIENT_SECRET,

                                grant_type:
                                    "authorization_code",

                                code,

                                redirect_uri:
                                    LOGIN_REDIRECT_URI
                            })
                    }
                );

            const tokenData =
                await tokenResponse.json();

            if (!tokenResponse.ok) {

                console.error(
                    "Discord token error:",
                    tokenData
                );

                return res.status(500).send(`
                    <h1>Discord Authentication Failed</h1>
                    <p>Discord rejected the login request.</p>
                    <a href="/">Return to Lunars</a>
                `);
            }

            // -----------------------------------------
            // Get Discord user
            // -----------------------------------------

            const userResponse =
                await fetch(
                    "https://discord.com/api/users/@me",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${tokenData.access_token}`
                        }
                    }
                );

            const user =
                await userResponse.json();

            if (!userResponse.ok) {

                console.error(
                    "Discord user error:",
                    user
                );

                return res.status(500).send(
                    "Could not retrieve your Discord account."
                );
            }

            // -----------------------------------------
            // Get user's servers
            // -----------------------------------------

            const guildResponse =
                await fetch(
                    "https://discord.com/api/users/@me/guilds",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${tokenData.access_token}`
                        }
                    }
                );

            const guilds =
                await guildResponse.json();

            if (!guildResponse.ok) {

                console.error(
                    "Discord guild error:",
                    guilds
                );

                return res.status(500).send(
                    "Could not retrieve your Discord servers."
                );
            }

            // -----------------------------------------
            // Save session
            // -----------------------------------------

            req.session.user = {
                id:
                    user.id,

                username:
                    user.username,

                global_name:
                    user.global_name,

                avatar:
                    user.avatar
            };

            req.session.guilds =
                guilds;

            /*
             * Keep the OAuth token server-side.
             * Never send this token to index.html.
             */

            req.session.discordAccessToken =
                tokenData.access_token;

            console.log(
                `✔ Logged in: ${user.username}`
            );

            res.redirect("/");

        } catch (error) {

            console.error(
                "OAuth error:",
                error
            );

            res.status(500).send(
                "Something went wrong while connecting to Discord."
            );
        }
    }
);

// =====================================================
// BOT INVITE
// =====================================================
//
// IMPORTANT:
// This is the standard Discord bot authorization URL.
// It does NOT use an OAuth redirect URI.
//
// =====================================================

app.get("/invite", (req, res) => {

    const permissions =
        "36700160";

    const params =
        new URLSearchParams({
            client_id:
                CLIENT_ID,

            scope:
                "bot applications.commands",

            permissions:
                permissions
        });

    const inviteURL =
        `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log(
        "🤖 Redirecting user to Discord bot authorization..."
    );

    res.redirect(inviteURL);
});

// =====================================================
// BOT INVITE API
// =====================================================

app.get(
    "/api/bot/invite",
    (req, res) => {

        const permissions =
            "36700160";

        const params =
            new URLSearchParams({
                client_id:
                    CLIENT_ID,

                scope:
                    "bot applications.commands",

                permissions:
                    permissions
            });

        res.json({
            url:
                `https://discord.com/oauth2/authorize?${params.toString()}`
        });
    }
);

// =====================================================
// CURRENT USER
// =====================================================

app.get(
    "/api/me",
    (req, res) => {

        if (!req.session.user) {

            return res.json({
                loggedIn:
                    false,

                user:
                    null
            });
        }

        res.json({
            loggedIn:
                true,

            user:
                req.session.user
        });
    }
);

// =====================================================
// USER SERVERS
// =====================================================

app.get(
    "/api/guilds",
    (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "Not logged in."
            });
        }

        const guilds =
            req.session.guilds || [];

        res.json({
            guilds:
                guilds.map(
                    guild => ({
                        id:
                            guild.id,

                        name:
                            guild.name,

                        icon:
                            guild.icon,

                        owner:
                            guild.owner,

                        permissions:
                            guild.permissions,

                        features:
                            guild.features
                    })
                )
        });
    }
);

// =====================================================
// BOT STATS
// =====================================================
//
// These can be updated by your actual bot.
// Set BOT_GUILD_COUNT and BOT_MEMBER_COUNT
// in Render if you want values here.
//

app.get(
    "/api/bot/stats",
    (req, res) => {

        const guildCount =
            Number(
                process.env.BOT_GUILD_COUNT || 0
            );

        const memberCount =
            Number(
                process.env.BOT_MEMBER_COUNT || 0
            );

        res.json({
            online:
                true,

            bot:
                "LunarsMusicBot",

            guilds:
                guildCount,

            members:
                memberCount,

            website:
                "online",

            timestamp:
                new Date().toISOString()
        });
    }
);

// =====================================================
// STATUS
// =====================================================

app.get(
    "/api/status",
    (req, res) => {

        res.json({
            online:
                true,

            bot:
                "LunarsMusicBot",

            website:
                "online",

            timestamp:
                new Date().toISOString()
        });
    }
);

// =====================================================
// LOGOUT
// =====================================================

app.get(
    "/auth/logout",
    (req, res) => {

        req.session.destroy(
            error => {

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
            }
        );
    }
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({
            status:
                "ok",

            bot:
                "LunarsMusicBot",

            uptime:
                process.uptime()
        });
    }
);

// =====================================================
// WEBSITE FALLBACK
// =====================================================
//
// Express 5 does not accept app.get("*").
// This middleware avoids the "Missing parameter name"
// error you previously encountered.
//

app.use(
    (req, res, next) => {

        if (
            req.method === "GET" &&
            !req.path.startsWith("/api/") &&
            !req.path.startsWith("/auth/")
        ) {

            return res.sendFile(
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
        }

        next();
    }
);

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    (error, req, res, next) => {

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
    }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "=============================================="
        );
        console.log(
            "          LUNARS MUSIC WEBSITE"
        );
        console.log(
            "=============================================="
        );

        console.log(
            `🌐 Website: ${PUBLIC_URL}`
        );

        console.log(
            `🔐 Login: ${PUBLIC_URL}/auth/discord`
        );

        console.log(
            `🤖 Add Bot: ${PUBLIC_URL}/invite`
        );

        console.log(
            `📊 Bot stats: ${PUBLIC_URL}/api/bot/stats`
        );

        console.log(
            `❤️ Status: ${PUBLIC_URL}/api/status`
        );

        console.log(
            "=============================================="
        );

        console.log(
            "✅ Server started successfully!"
        );

        console.log("");
    }
);
