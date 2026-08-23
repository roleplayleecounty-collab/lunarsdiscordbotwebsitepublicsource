/*
=========================================================
🌙 LYRA SUPPORT WEBSITE
=========================================================

Express + Discord OAuth2 website

Folder structure:

lyrasupport/
│
├── public/
│   ├── index.html
│   └── style.css
│
├── server.js
├── package.json
├── package-lock.json
├── .env
└── .gitignore

IMPORTANT:
- Never upload .env to GitHub.
- Put your secrets in Render Environment Variables.
=========================================================
*/


// =======================================================
// IMPORTS
// =======================================================

const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");


// =======================================================
// APP
// =======================================================

const app = express();


// =======================================================
// PORT
// =======================================================

const PORT = process.env.PORT || 3000;


// =======================================================
// ENVIRONMENT VARIABLES
// =======================================================

const CLIENT_ID =
    process.env.DISCORD_CLIENT_ID;

const CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET;

const REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    `http://localhost:${PORT}/auth/discord/callback`;

const SESSION_SECRET =
    process.env.SESSION_SECRET;


// =======================================================
// CHECK REQUIRED ENVIRONMENT VARIABLES
// =======================================================

if (!CLIENT_ID) {

    console.error(
        "❌ Missing DISCORD_CLIENT_ID"
    );

}

if (!CLIENT_SECRET) {

    console.error(
        "❌ Missing DISCORD_CLIENT_SECRET"
    );

}

if (!SESSION_SECRET) {

    console.error(
        "❌ Missing SESSION_SECRET"
    );

}


// =======================================================
// BASIC APP SETTINGS
// =======================================================

app.disable("x-powered-by");

app.set(
    "trust proxy",
    1
);


// =======================================================
// BODY PARSING
// =======================================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


// =======================================================
// SESSION
// =======================================================

app.use(
    session({

        name: "lyra.sid",

        secret:
            SESSION_SECRET ||
            crypto.randomBytes(32).toString("hex"),

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


// =======================================================
// STATIC WEBSITE
// =======================================================
//
// This serves:
//
// /
// /index.html
// /style.css
// /anything-inside-public
//
// Example:
//
// public/index.html
//       ↓
// https://lyrasupport.onrender.com/
//
// public/style.css
//       ↓
// https://lyrasupport.onrender.com/style.css
// =======================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// =======================================================
// DISCORD API
// =======================================================

const DISCORD_API =
    "https://discord.com/api/v10";


// =======================================================
// LYRA BOT CLIENT ID
// =======================================================

const LYRA_CLIENT_ID =
    CLIENT_ID;


// =======================================================
// OAUTH SCOPES
// =======================================================

const OAUTH_SCOPES = [
    "identify",
    "guilds"
];


// =======================================================
// HELPER:
// GET DISCORD API
// =======================================================

async function discordRequest(
    endpoint,
    options = {}
) {

    const response =
        await fetch(
            `${DISCORD_API}${endpoint}`,
            {

                ...options,

                headers: {

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})

                }

            }
        );


    let data;

    try {

        data =
            await response.json();

    } catch {

        data = null;

    }


    if (!response.ok) {

        const error =
            new Error(
                `Discord API returned ${response.status}`
            );

        error.status =
            response.status;

        error.data =
            data;

        throw error;

    }


    return data;

}


// =======================================================
// HELPER:
// GET USER PROFILE
// =======================================================

async function getDiscordUser(
    accessToken
) {

    return await discordRequest(
        "/users/@me",
        {

            headers: {

                Authorization:
                    `Bearer ${accessToken}`

            }

        }
    );

}


// =======================================================
// HELPER:
// GET USER GUILDS
// =======================================================

async function getDiscordGuilds(
    accessToken
) {

    return await discordRequest(
        "/users/@me/guilds",
        {

            headers: {

                Authorization:
                    `Bearer ${accessToken}`

            }

        }
    );

}


// =======================================================
// HELPER:
// CREATE DISCORD AVATAR URL
// =======================================================

function getAvatarURL(
    user
) {

    if (!user) {

        return null;

    }


    if (user.avatar) {

        return (
            `https://cdn.discordapp.com/avatars/` +
            `${user.id}/${user.avatar}.png?size=256`
        );

    }


    const discriminator =
        Number(user.discriminator) || 0;


    const defaultAvatar =
        discriminator % 5;


    return (
        `https://cdn.discordapp.com/embed/avatars/` +
        `${defaultAvatar}.png`
    );

}


// =======================================================
// HELPER:
// CHECK SERVER PERMISSIONS
// =======================================================

function getGuildPermissions(
    guild
) {

    const permissions =
        BigInt(
            guild.permissions || "0"
        );


    // Discord permission flags

    const ADMINISTRATOR =
        1n << 3n;

    const MANAGE_GUILD =
        1n << 5n;


    const administrator =
        (permissions &
            ADMINISTRATOR) !== 0n;


    const manageGuild =
        (permissions &
            MANAGE_GUILD) !== 0n;


    const owner =
        guild.owner === true;


    return {

        owner,

        administrator,

        manageGuild,

        canInvite:
            owner ||
            administrator ||
            manageGuild

    };

}


// =======================================================
// HELPER:
// FORMAT SERVER DATA
// =======================================================

function formatGuild(
    guild
) {

    const permissions =
        getGuildPermissions(
            guild
        );


    let icon = null;


    if (guild.icon) {

        icon =
            `https://cdn.discordapp.com/icons/` +
            `${guild.id}/${guild.icon}.png?size=256`;

    }


    let permissionLabel =
        "Member";


    let permissionType =
        "member";


    if (permissions.owner) {

        permissionLabel =
            "Owner";

        permissionType =
            "owner";

    } else if (
        permissions.administrator
    ) {

        permissionLabel =
            "Administrator";

        permissionType =
            "administrator";

    } else if (
        permissions.manageGuild
    ) {

        permissionLabel =
            "Manage Server";

        permissionType =
            "manager";

    }


    // Bot invite URL
    //
    // This sends the user to Discord's
    // authorization page for Lyra.

    const inviteURL =
        `https://discord.com/oauth2/authorize` +
        `?client_id=${encodeURIComponent(LYRA_CLIENT_ID)}` +
        `&permissions=8` +
        `&scope=bot%20applications.commands` +
        `&guild_id=${encodeURIComponent(guild.id)}`;


    return {

        id:
            guild.id,

        name:
            guild.name,

        icon,

        owner:
            permissions.owner,

        administrator:
            permissions.administrator,

        manageGuild:
            permissions.manageGuild,

        canInvite:
            permissions.canInvite,

        permissionLabel,

        permissionType,

        inviteURL

    };

}


// =======================================================
// HOME PAGE
// =======================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// =======================================================
// DISCORD LOGIN
// =======================================================
//
// User visits:
//
// /auth/discord
//
// Then gets redirected to Discord.
//
// =======================================================

app.get(
    "/auth/discord",
    (req, res) => {

        if (
            !CLIENT_ID ||
            !CLIENT_SECRET
        ) {

            return res.status(500).send(
                "Discord OAuth is not configured."
            );

        }


        const state =
            crypto
                .randomBytes(32)
                .toString("hex");


        // Save state in session
        // to protect against OAuth attacks.

        req.session.oauthState =
            state;


        const params =
            new URLSearchParams({

                client_id:
                    CLIENT_ID,

                redirect_uri:
                    REDIRECT_URI,

                response_type:
                    "code",

                scope:
                    OAUTH_SCOPES.join(" "),

                state

            });


        const discordURL =
            `https://discord.com/oauth2/authorize?${params.toString()}`;


        console.log(
            "🔵 Redirecting user to Discord OAuth"
        );


        res.redirect(
            discordURL
        );

    }
);


// =======================================================
// DISCORD CALLBACK
// =======================================================
//
// Discord redirects here:
//
// /auth/discord/callback
//
// =======================================================

app.get(
    "/auth/discord/callback",
    async (req, res) => {

        try {

            const {
                code,
                state,
                error
            } = req.query;


            // ------------------------------------------------
            // USER CANCELLED LOGIN
            // ------------------------------------------------

            if (error) {

                console.log(
                    `⚠️ Discord OAuth cancelled: ${error}`
                );

                return res.redirect(
                    "/?login=cancelled"
                );

            }


            // ------------------------------------------------
            // NO CODE
            // ------------------------------------------------

            if (!code) {

                return res.status(400).send(
                    "Missing Discord authorization code."
                );

            }


            // ------------------------------------------------
            // CHECK OAUTH STATE
            // ------------------------------------------------

            if (
                !state ||
                state !==
                    req.session.oauthState
            ) {

                console.warn(
                    "⚠️ Invalid OAuth state."
                );

                return res.status(403).send(
                    "Invalid OAuth state."
                );

            }


            // State should only be used once.

            delete req.session.oauthState;


            // ------------------------------------------------
            // EXCHANGE CODE FOR TOKEN
            // ------------------------------------------------

            const tokenResponse =
                await fetch(
                    `${DISCORD_API}/oauth2/token`,
                    {

                        method:
                            "POST",

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
                                    REDIRECT_URI

                            })

                    }
                );


            const tokenData =
                await tokenResponse.json();


            if (
                !tokenResponse.ok
            ) {

                console.error(
                    "❌ Discord token exchange failed:",
                    tokenData
                );

                return res.status(500).send(
                    "Could not complete Discord login."
                );

            }


            // ------------------------------------------------
            // SAVE TOKEN
            // ------------------------------------------------

            req.session.accessToken =
                tokenData.access_token;


            // ------------------------------------------------
            // GET DISCORD USER
            // ------------------------------------------------

            const user =
                await getDiscordUser(
                    tokenData.access_token
                );


            // ------------------------------------------------
            // GET DISCORD SERVERS
            // ------------------------------------------------

            const guilds =
                await getDiscordGuilds(
                    tokenData.access_token
                );


            // ------------------------------------------------
            // FORMAT USER
            // ------------------------------------------------

            req.session.user = {

                id:
                    user.id,

                username:
                    user.username,

                globalName:
                    user.global_name ||
                    user.username,

                discriminator:
                    user.discriminator,

                avatar:
                    getAvatarURL(user)

            };


            // ------------------------------------------------
            // FORMAT SERVERS
            // ------------------------------------------------

            req.session.guilds =
                guilds.map(
                    formatGuild
                );


            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log(
                "🌙 DISCORD LOGIN"
            );

            console.log(
                `User: ${user.username}`
            );

            console.log(
                `ID: ${user.id}`
            );

            console.log(
                `Servers: ${guilds.length}`
            );

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );


            // ------------------------------------------------
            // REDIRECT HOME
            // ------------------------------------------------

            res.redirect(
                "/?login=success"
            );

        } catch (error) {

            console.error(
                "❌ Discord OAuth error:",
                error
            );


            res.status(500).send(
                "Something went wrong while logging into Discord."
            );

        }

    }
);


// =======================================================
// CURRENT USER
// =======================================================
//
// Frontend can request:
//
// GET /api/user
//
// =======================================================

app.get(
    "/api/user",
    (req, res) => {

        if (
            !req.session.user
        ) {

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


// =======================================================
// CURRENT USER'S SERVERS
// =======================================================
//
// GET /api/guilds
//
// =======================================================

app.get(
    "/api/guilds",
    (req, res) => {

        if (
            !req.session.user
        ) {

            return res.status(401).json({

                error:
                    "Not logged in."

            });

        }


        res.json({

            success:
                true,

            guilds:
                req.session.guilds || []

        });

    }
);


// =======================================================
// FULL DASHBOARD DATA
// =======================================================
//
// Instead of making the frontend request:
//
// /api/user
// /api/guilds
//
// it can simply request:
//
// /api/dashboard
//
// =======================================================

app.get(
    "/api/dashboard",
    (req, res) => {

        if (
            !req.session.user
        ) {

            return res.json({

                loggedIn:
                    false,

                user:
                    null,

                guilds:
                    []

            });

        }


        res.json({

            loggedIn:
                true,

            user:
                req.session.user,

            guilds:
                req.session.guilds || []

        });

    }
);


// =======================================================
// LOGOUT
// =======================================================

app.get(
    "/auth/logout",
    (req, res) => {

        const username =
            req.session.user?.username;


        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "❌ Logout error:",
                        error
                    );

                    return res.status(500).send(
                        "Could not log out."
                    );

                }


                res.clearCookie(
                    "lyra.sid"
                );


                console.log(
                    `👋 Logged out: ${
                        username || "Unknown user"
                    }`
                );


                res.redirect(
                    "/?logout=success"
                );

            }
        );

    }
);


// =======================================================
// HEALTH CHECK
// =======================================================
//
// Render can use this to determine whether
// the website is alive.
//
// =======================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            status:
                "online",

            service:
                "Lyra Support",

            timestamp:
                new Date().toISOString()

        });

    }
);


// =======================================================
// 404 HANDLER
// =======================================================

app.use(
    (req, res) => {

        // API requests get JSON.

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(404).json({

                error:
                    "API endpoint not found."

            });

        }


        // Everything else gets the website.

        res.status(404).sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// =======================================================
// ERROR HANDLER
// =======================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.error(
            "❌ WEBSITE ERROR"
        );

        console.error(
            error
        );

        console.error(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(500).json({

                error:
                    "Internal server error."

            });

        }


        res.status(500).send(
            "Lyra encountered a server error."
        );

    }
);


// =======================================================
// START SERVER
// =======================================================

app.listen(
    PORT,
    () => {

        console.log(
            ""
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "🌙 LYRA SUPPORT WEBSITE"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            `📁 Public: ${path.join(
                __dirname,
                "public"
            )}`
        );

        console.log(
            `🔗 Redirect: ${REDIRECT_URI}`
        );

        console.log(
            `🔵 Discord OAuth: ${
                CLIENT_ID
                    ? "Configured"
                    : "MISSING"
            }`
        );

        console.log(
            `🔐 Client Secret: ${
                CLIENT_SECRET
                    ? "Configured"
                    : "MISSING"
            }`
        );

        console.log(
            `🍪 Sessions: ${
                SESSION_SECRET
                    ? "Configured"
                    : "MISSING"
            }`
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "✨ LYRA WEBSITE ONLINE"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

    }
);
