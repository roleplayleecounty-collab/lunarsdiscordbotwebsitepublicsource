require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIG
// ============================================================

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

const REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    `http://localhost:${PORT}/auth/discord/callback`;

const SESSION_SECRET = process.env.SESSION_SECRET;

const BOT_TOKEN = process.env.TOKEN;

const BOT_NAME = "LunarsMusicBot";

if (!CLIENT_ID) {
    console.error("❌ Missing DISCORD_CLIENT_ID in .env");
    process.exit(1);
}

if (!CLIENT_SECRET) {
    console.error("❌ Missing DISCORD_CLIENT_SECRET in .env");
    process.exit(1);
}

if (!SESSION_SECRET) {
    console.error("❌ Missing SESSION_SECRET in .env");
    process.exit(1);
}

// ============================================================
// EXPRESS
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    })
);

// Your website files
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// DISCORD API HELPER
// ============================================================

async function discordFetch(url, options = {}) {
    const response = await fetch(
        `https://discord.com/api/v10${url}`,
        options
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    return {
        response,
        data,
    };
}

// ============================================================
// DISCORD LOGIN
// ============================================================

app.get("/auth/discord", (req, res) => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",

        // identify = account information
        // guilds = servers the user belongs to
        scope: "identify guilds",
    });

    const url =
        `https://discord.com/oauth2/authorize?${params.toString()}`;

    res.redirect(url);
});

// ============================================================
// DISCORD OAUTH CALLBACK
// ============================================================

app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send(`
            <h1>Discord Login Failed</h1>
            <p>No authorization code was provided.</p>
            <a href="/">Go back</a>
        `);
    }

    try {
        // --------------------------------------------------------
        // Exchange OAuth code for access token
        // --------------------------------------------------------

        const tokenResponse = await fetch(
            "https://discord.com/api/v10/oauth2/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },

                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,

                    grant_type: "authorization_code",

                    code,

                    redirect_uri: REDIRECT_URI,
                }),
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(
                "Discord OAuth token error:",
                tokenData
            );

            return res.status(500).send(`
                <h1>Discord Login Failed</h1>
                <p>Discord rejected the authorization request.</p>
                <a href="/">Go back</a>
            `);
        }

        const accessToken = tokenData.access_token;

        // --------------------------------------------------------
        // Get Discord user
        // --------------------------------------------------------

        const userResult = await discordFetch(
            "/users/@me",
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,
                },
            }
        );

        if (!userResult.response.ok) {
            console.error(
                "Discord user error:",
                userResult.data
            );

            return res.status(500).send(
                "Could not retrieve your Discord account."
            );
        }

        const user = userResult.data;

        // --------------------------------------------------------
        // Get user's Discord servers
        // --------------------------------------------------------

        const guildResult = await discordFetch(
            "/users/@me/guilds",
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,
                },
            }
        );

        if (!guildResult.response.ok) {
            console.error(
                "Discord guild error:",
                guildResult.data
            );

            return res.status(500).send(
                "Could not retrieve your Discord servers."
            );
        }

        const guilds = guildResult.data || [];

        // --------------------------------------------------------
        // Save session
        // --------------------------------------------------------

        req.session.user = {
            id: user.id,

            username: user.username,

            global_name:
                user.global_name || user.username,

            avatar: user.avatar,

            discriminator:
                user.discriminator,
        };

        req.session.guilds = guilds;

        // Keep OAuth token server-side only.
        req.session.discordAccessToken =
            accessToken;

        console.log(
            `✅ Discord login: ${user.username}`
        );

        console.log(
            `   Servers returned: ${guilds.length}`
        );

        res.redirect("/");

    } catch (error) {
        console.error(
            "Discord OAuth error:",
            error
        );

        res.status(500).send(`
            <h1>Something went wrong</h1>
            <p>Unable to connect to Discord.</p>
            <a href="/">Go back</a>
        `);
    }
});

// ============================================================
// CURRENT USER
// ============================================================

app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.json({
            loggedIn: false,
            user: null,
        });
    }

    res.json({
        loggedIn: true,

        user: req.session.user,
    });
});

// ============================================================
// USER SERVERS
// ============================================================

app.get("/api/guilds", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Not logged in.",
        });
    }

    const guilds =
        req.session.guilds || [];

    res.json({
        count: guilds.length,

        guilds: guilds.map((guild) => ({
            id: guild.id,

            name: guild.name,

            icon: guild.icon,

            owner: guild.owner,

            permissions:
                guild.permissions,

            features:
                guild.features || [],

            // Useful for your website
            canManage:
                Boolean(guild.owner) ||
                (
                    BigInt(guild.permissions || "0") &
                    0x20n
                ) !== 0n,
        })),
    });
});

// ============================================================
// BOT INFORMATION
// ============================================================

app.get("/api/bot", async (req, res) => {
    try {
        // --------------------------------------------------------
        // If BOT_TOKEN exists, get real bot information
        // --------------------------------------------------------

        if (BOT_TOKEN) {
            const result = await discordFetch(
                "/users/@me",
                {
                    headers: {
                        Authorization:
                            `Bot ${BOT_TOKEN}`,
                    },
                }
            );

            if (result.response.ok) {
                const bot = result.data;

                return res.json({
                    online: true,

                    id: bot.id,

                    username:
                        bot.username,

                    global_name:
                        bot.global_name,

                    avatar:
                        bot.avatar,

                    avatarUrl:
                        bot.avatar
                            ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png?size=256`
                            : null,
                });
            }
        }

        // Fallback if the bot token isn't available
        res.json({
            online: false,

            name: BOT_NAME,

            message:
                "Bot information is currently unavailable.",
        });

    } catch (error) {
        console.error(
            "Bot information error:",
            error
        );

        res.status(500).json({
            online: false,

            name: BOT_NAME,
        });
    }
});

// ============================================================
// BOT STATS
//
// Gets the number of servers and approximate member count.
// ============================================================

app.get("/api/bot/stats", async (req, res) => {
    if (!BOT_TOKEN) {
        return res.json({
            online: false,

            guilds: 0,

            members: 0,

            message:
                "BOT_TOKEN is not configured.",
        });
    }

    try {
        const result = await discordFetch(
            "/users/@me/guilds",
            {
                headers: {
                    Authorization:
                        `Bot ${BOT_TOKEN}`,
                },
            }
        );

        if (!result.response.ok) {
            console.error(
                "Bot guild request failed:",
                result.data
            );

            return res.status(500).json({
                online: false,
            });
        }

        const guilds =
            result.data || [];

        // Discord's bot guild endpoint doesn't
        // necessarily provide member_count unless
        // the API includes it.
        let members = 0;

        for (const guild of guilds) {
            if (
                typeof guild.approximate_member_count ===
                "number"
            ) {
                members +=
                    guild.approximate_member_count;
            }
        }

        res.json({
            online: true,

            guilds: guilds.length,

            members,

            botName: BOT_NAME,
        });

    } catch (error) {
        console.error(
            "Bot stats error:",
            error
        );

        res.status(500).json({
            online: false,

            guilds: 0,

            members: 0,
        });
    }
});

// ============================================================
// BOT INVITE
// ============================================================

app.get("/api/bot/invite", (req, res) => {
    const permissions =
        process.env.BOT_PERMISSIONS ||
        "36700160";

    const invite =
        new URL(
            "https://discord.com/oauth2/authorize"
        );

    invite.searchParams.set(
        "client_id",
        CLIENT_ID
    );

    invite.searchParams.set(
        "scope",
        "bot applications.commands"
    );

    invite.searchParams.set(
        "permissions",
        permissions
    );

    res.json({
        url:
            invite.toString(),
    });
});

// ============================================================
// INVITE PAGE
//
// You can send people here:
// /invite
//
// It displays your invite page and lets the frontend
// show a thank-you message after they return.
// ============================================================

app.get("/invite", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

// ============================================================
// THANK-YOU DATA
// ============================================================

app.get("/api/invite/thank-you", (req, res) => {
    const serverName =
        req.query.server ||
        req.query.guild ||
        null;

    res.json({
        success: true,

        botName: BOT_NAME,

        serverName,

        message: serverName
            ? `Thank you for inviting ${BOT_NAME} to ${serverName}!`
            : `Thank you for inviting ${BOT_NAME} to your server!`,
    });
});

// ============================================================
// LOGOUT
// ============================================================

app.get("/auth/logout", (req, res) => {
    req.session.destroy((error) => {
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

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/status", (req, res) => {
    res.json({
        online: true,

        bot: BOT_NAME,

        website:
            "online",

        timestamp:
            new Date().toISOString(),
    });
});

// ============================================================
// 404 API
// ============================================================

app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API endpoint not found.",
    });
});

// ============================================================
// WEBSITE FALLBACK
//
// IMPORTANT:
// Express 5 doesn't accept app.get("*", ...)
// so we use middleware instead.
// ============================================================

app.use((req, res, next) => {
    if (
        req.method !== "GET" ||
        req.path.startsWith("/api/")
    ) {
        return next();
    }

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
    res.status(404).send(
        "404 - Page not found"
    );
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
    console.error(
        "Server error:",
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error:
            "Internal server error.",
    });
});

// ============================================================
// START
// ============================================================

app.listen(
    PORT,
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
            `🌐 Website: http://localhost:${PORT}`
        );

        console.log(
            `🔐 Login: http://localhost:${PORT}/auth/discord`
        );

        console.log(
            `🤖 Bot stats: http://localhost:${PORT}/api/bot/stats`
        );

        console.log(
            `❤️ Status: http://localhost:${PORT}/api/status`
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
