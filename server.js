/*
============================================================
🌙 LYRA SUPPORT WEBSITE
============================================================

Project:

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


FEATURES
------------------------------------------------------------

✅ Express website
✅ Serves /public
✅ Discord OAuth2 login
✅ Secure OAuth state
✅ Discord user profile
✅ Discord avatar
✅ Discord server list
✅ Server permission detection
✅ Owner detection
✅ Administrator detection
✅ Manage Server detection
✅ Lyra invite links
✅ Session login
✅ Logout
✅ Dashboard API
✅ Health check
✅ Error handling
✅ Render compatible


IMPORTANT
------------------------------------------------------------

DO NOT upload .env to GitHub.

On Render, put your secrets in:

Render
→ Environment
→ Environment Variables


Required variables:

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI
SESSION_SECRET

============================================================
*/


// ==========================================================
// IMPORTS
// ==========================================================

const express = require("express");

const session = require("express-session");

const path = require("path");

const crypto = require("crypto");


// ==========================================================
// CREATE EXPRESS APP
// ==========================================================

const app = express();


// ==========================================================
// PORT
// ==========================================================

const PORT =
    process.env.PORT || 3000;


// ==========================================================
// DISCORD CONFIG
// ==========================================================

const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID;

const DISCORD_CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET;

const DISCORD_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    `http://localhost:${PORT}/auth/discord/callback`;

const SESSION_SECRET =
    process.env.SESSION_SECRET;


// ==========================================================
// LYRA CONFIG
// ==========================================================
//
// Discord permission values are bit flags.
//
// 0 = no permissions
// 1024 = View Channel
// 2048 = Send Messages
// etc.
//
// You can change this later.
//
// Do NOT use 8 unless you intentionally want
// Administrator permission.
//
// ==========================================================

const LYRA_PERMISSIONS =
    process.env.LYRA_PERMISSIONS || "0";


// ==========================================================
// DISCORD API
// ==========================================================

const DISCORD_API =
    "https://discord.com/api/v10";


// ==========================================================
// BASIC EXPRESS CONFIG
// ==========================================================

app.disable(
    "x-powered-by"
);


// Render sits behind a proxy.
// This allows secure cookies to work correctly.

app.set(
    "trust proxy",
    1
);


// ==========================================================
// BODY PARSING
// ==========================================================

app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended: true
    })
);


// ==========================================================
// SESSION
// ==========================================================

app.use(
    session({

        name:
            "lyra.sid",

        secret:
            SESSION_SECRET ||
            crypto.randomBytes(48).toString("hex"),

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {

            httpOnly:
                true,

            secure:
                process.env.NODE_ENV === "production",

            sameSite:
                "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7

        }

    })
);


// ==========================================================
// SERVE PUBLIC FOLDER
// ==========================================================
//
// This means:
//
// public/index.html
// → /
//
// public/style.css
// → /style.css
//
// public/images/example.png
// → /images/example.png
//
// ==========================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ==========================================================
// ENVIRONMENT CHECK
// ==========================================================

function checkEnvironment() {

    console.log(
        ""
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
        "🌙 LYRA WEBSITE CONFIGURATION"
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );


    console.log(
        `CLIENT ID: ${
            DISCORD_CLIENT_ID
                ? "✅ Loaded"
                : "❌ Missing"
        }`
    );


    console.log(
        `CLIENT SECRET: ${
            DISCORD_CLIENT_SECRET
                ? "✅ Loaded"
                : "❌ Missing"
        }`
    );


    console.log(
        `REDIRECT URI: ${
            DISCORD_REDIRECT_URI
        }`
    );


    console.log(
        `SESSION SECRET: ${
            SESSION_SECRET
                ? "✅ Loaded"
                : "❌ Missing"
        }`
    );


    console.log(
        `BOT PERMISSIONS: ${
            LYRA_PERMISSIONS
        }`
    );


    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );


    if (!DISCORD_CLIENT_ID) {

        console.warn(
            "⚠️ DISCORD_CLIENT_ID is missing."
        );

    }


    if (!DISCORD_CLIENT_SECRET) {

        console.warn(
            "⚠️ DISCORD_CLIENT_SECRET is missing."
        );

    }


    if (!SESSION_SECRET) {

        console.warn(
            "⚠️ SESSION_SECRET is missing."
        );

    }

}


// ==========================================================
// DISCORD API REQUEST HELPER
// ==========================================================

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

                    ...(options.headers || {}),

                    "User-Agent":
                        "LyraSupport/1.0"

                }

            }
        );


    let data = null;


    try {

        data =
            await response.json();

    } catch {

        data =
            null;

    }


    if (!response.ok) {

        const error =
            new Error(
                `Discord API error: ${response.status}`
            );


        error.status =
            response.status;


        error.data =
            data;


        throw error;

    }


    return data;

}


// ==========================================================
// GET DISCORD USER
// ==========================================================

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


// ==========================================================
// GET DISCORD GUILDS
// ==========================================================

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


// ==========================================================
// GET USER AVATAR
// ==========================================================

function getAvatarURL(
    user
) {

    if (!user) {

        return null;

    }


    if (user.avatar) {

        return (
            "https://cdn.discordapp.com/avatars/" +
            `${user.id}/` +
            `${user.avatar}.png?size=256`
        );

    }


    // Discord default avatar

    let discriminator =
        Number(
            user.discriminator
        );


    if (
        Number.isNaN(
            discriminator
        )
    ) {

        discriminator = 0;

    }


    const defaultAvatar =
        discriminator % 5;


    return (
        "https://cdn.discordapp.com/embed/avatars/" +
        `${defaultAvatar}.png`
    );

}


// ==========================================================
// GET SERVER ICON
// ==========================================================

function getGuildIconURL(
    guild
) {

    if (
        !guild ||
        !guild.icon
    ) {

        return null;

    }


    return (
        "https://cdn.discordapp.com/icons/" +
        `${guild.id}/` +
        `${guild.icon}.png?size=256`
    );

}


// ==========================================================
// DISCORD PERMISSION FLAGS
// ==========================================================

const PERMISSIONS = {

    ADMINISTRATOR:
        1n << 3n,

    MANAGE_GUILD:
        1n << 5n

};


// ==========================================================
// GET SERVER PERMISSIONS
// ==========================================================

function getGuildPermissions(
    guild
) {

    let permissions =
        0n;


    try {

        permissions =
            BigInt(
                guild.permissions || "0"
            );

    } catch {

        permissions =
            0n;

    }


    const administrator =
        (
            permissions &
            PERMISSIONS.ADMINISTRATOR
        ) !== 0n;


    const manageGuild =
        (
            permissions &
            PERMISSIONS.MANAGE_GUILD
        ) !== 0n;


    const owner =
        guild.owner === true;


    /*
    --------------------------------------------------------
    CAN INVITE
    --------------------------------------------------------

    A user can normally manage the server if:

    - They own it
    - They have Administrator
    - They have Manage Server

    --------------------------------------------------------
    */

    const canInvite =
        owner ||
        administrator ||
        manageGuild;


    let permissionType =
        "member";


    let permissionLabel =
        "Member";


    if (owner) {

        permissionType =
            "owner";

        permissionLabel =
            "Owner";

    }

    else if (administrator) {

        permissionType =
            "administrator";

        permissionLabel =
            "Administrator";

    }

    else if (manageGuild) {

        permissionType =
            "manager";

        permissionLabel =
            "Manage Server";

    }


    return {

        owner,

        administrator,

        manageGuild,

        canInvite,

        permissionType,

        permissionLabel

    };

}


// ==========================================================
// CREATE BOT INVITE
// ==========================================================

function createInviteURL(
    guildId
) {

    const params =
        new URLSearchParams({

            client_id:
                DISCORD_CLIENT_ID,

            permissions:
                String(
                    LYRA_PERMISSIONS
                ),

            scope:
                "bot applications.commands",

            guild_id:
                guildId

        });


    return (
        "https://discord.com/oauth2/authorize?" +
        params.toString()
    );

}


// ==========================================================
// FORMAT GUILD
// ==========================================================

function formatGuild(
    guild
) {

    const permissions =
        getGuildPermissions(
            guild
        );


    return {

        id:
            guild.id,

        name:
            guild.name,

        icon:
            getGuildIconURL(
                guild
            ),

        owner:
            permissions.owner,

        administrator:
            permissions.administrator,

        manageGuild:
            permissions.manageGuild,

        canInvite:
            permissions.canInvite,

        permissionType:
            permissions.permissionType,

        permissionLabel:
            permissions.permissionLabel,

        inviteURL:
            permissions.canInvite
                ? createInviteURL(
                    guild.id
                )
                : null

    };

}


// ==========================================================
// HOME PAGE
// ==========================================================

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


// ==========================================================
// DISCORD LOGIN
// ==========================================================
//
// User clicks:
//
// Login with Discord
//
// Browser goes:
//
// /auth/discord
//
// Then we redirect to Discord.
//
// ==========================================================

app.get(
    "/auth/discord",
    (req, res) => {

        if (
            !DISCORD_CLIENT_ID ||
            !DISCORD_CLIENT_SECRET
        ) {

            console.error(
                "❌ Discord OAuth is not configured."
            );


            return res.status(
                500
            ).send(
                "Discord login is not configured on this server."
            );

        }


        // --------------------------------------------------
        // CREATE OAUTH STATE
        // --------------------------------------------------

        const state =
            crypto
                .randomBytes(
                    32
                )
                .toString(
                    "hex"
                );


        req.session.oauthState =
            state;


        // --------------------------------------------------
        // DISCORD OAUTH PARAMETERS
        // --------------------------------------------------

        const params =
            new URLSearchParams({

                client_id:
                    DISCORD_CLIENT_ID,

                redirect_uri:
                    DISCORD_REDIRECT_URI,

                response_type:
                    "code",

                scope:
                    "identify guilds",

                state

            });


        const authorizationURL =
            "https://discord.com/oauth2/authorize?" +
            params.toString();


        console.log(
            "🔵 Starting Discord OAuth..."
        );


        res.redirect(
            authorizationURL
        );

    }
);


// ==========================================================
// DISCORD CALLBACK
// ==========================================================

app.get(
    "/auth/discord/callback",
    async (req, res) => {

        try {

            const {
                code,
                state,
                error,
                error_description
            } = req.query;


            // ------------------------------------------------
            // DISCORD ERROR
            // ------------------------------------------------

            if (error) {

                console.warn(
                    "⚠️ Discord OAuth error:",
                    error,
                    error_description || ""
                );


                return res.redirect(
                    "/?login=cancelled"
                );

            }


            // ------------------------------------------------
            // CHECK CODE
            // ------------------------------------------------

            if (!code) {

                console.error(
                    "❌ No OAuth code received."
                );


                return res.status(
                    400
                ).send(
                    "Discord did not provide an authorization code."
                );

            }


            // ------------------------------------------------
            // CHECK STATE
            // ------------------------------------------------

            if (
                !state ||
                !req.session.oauthState ||
                state !==
                    req.session.oauthState
            ) {

                console.error(
                    "❌ Invalid OAuth state."
                );


                return res.status(
                    403
                ).send(
                    "Invalid OAuth state. Please try logging in again."
                );

            }


            // State is single-use.

            delete req.session.oauthState;


            // ------------------------------------------------
            // EXCHANGE CODE
            // ------------------------------------------------

            console.log(
                "🔄 Exchanging Discord OAuth code..."
            );


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
                                    DISCORD_CLIENT_ID,

                                client_secret:
                                    DISCORD_CLIENT_SECRET,

                                grant_type:
                                    "authorization_code",

                                code:
                                    code,

                                redirect_uri:
                                    DISCORD_REDIRECT_URI

                            })

                    }
                );


            const tokenData =
                await tokenResponse.json();


            if (
                !tokenResponse.ok
            ) {

                console.error(
                    "❌ Token exchange failed:",
                    tokenData
                );


                return res.status(
                    500
                ).send(
                    "Discord login could not be completed."
                );

            }


            // ------------------------------------------------
            // ACCESS TOKEN
            // ------------------------------------------------

            const accessToken =
                tokenData.access_token;


            if (!accessToken) {

                throw new Error(
                    "Discord did not return an access token."
                );

            }


            // ------------------------------------------------
            // GET USER
            // ------------------------------------------------

            console.log(
                "👤 Getting Discord user..."
            );


            const user =
                await getDiscordUser(
                    accessToken
                );


            // ------------------------------------------------
            // GET SERVERS
            // ------------------------------------------------

            console.log(
                "🌐 Getting Discord servers..."
            );


            const guilds =
                await getDiscordGuilds(
                    accessToken
                );


            // ------------------------------------------------
            // FORMAT USER
            // ------------------------------------------------

            const formattedUser = {

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
                    getAvatarURL(
                        user
                    )

            };


            // ------------------------------------------------
            // FORMAT GUILDS
            // ------------------------------------------------

            const formattedGuilds =
                guilds.map(
                    formatGuild
                );


            // ------------------------------------------------
            // SAVE SESSION
            // ------------------------------------------------

            req.session.user =
                formattedUser;


            req.session.guilds =
                formattedGuilds;


            // We don't actually need to keep
            // the Discord access token for this
            // dashboard.

            req.session.accessToken =
                accessToken;


            // ------------------------------------------------
            // SAVE SESSION
            // ------------------------------------------------

            req.session.save(
                error => {

                    if (error) {

                        console.error(
                            "❌ Session save failed:",
                            error
                        );


                        return res.status(
                            500
                        ).send(
                            "Could not save your login session."
                        );

                    }


                    console.log(
                        ""
                    );

                    console.log(
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    );

                    console.log(
                        "🌙 LYRA DISCORD LOGIN"
                    );

                    console.log(
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    );

                    console.log(
                        `👤 User: ${
                            formattedUser.username
                        }`
                    );

                    console.log(
                        `🆔 ID: ${
                            formattedUser.id
                        }`
                    );

                    console.log(
                        `🌐 Servers: ${
                            formattedGuilds.length
                        }`
                    );

                    console.log(
                        `🤖 Inviteable Servers: ${
                            formattedGuilds.filter(
                                guild =>
                                    guild.canInvite
                            ).length
                        }`
                    );

                    console.log(
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    );


                    res.redirect(
                        "/?login=success"
                    );

                }
            );

        }

        catch (error) {

            console.error(
                ""
            );

            console.error(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.error(
                "❌ DISCORD LOGIN FAILED"
            );

            console.error(
                error
            );

            console.error(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );


            res.status(
                500
            ).send(
                "Something went wrong while logging into Discord."
            );

        }

    }
);


// ==========================================================
// API: CURRENT USER
// ==========================================================

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


// ==========================================================
// API: USER SERVERS
// ==========================================================

app.get(
    "/api/guilds",
    (req, res) => {

        if (
            !req.session.user
        ) {

            return res.status(
                401
            ).json({

                loggedIn:
                    false,

                error:
                    "You are not logged in."

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


// ==========================================================
// API: FULL DASHBOARD
// ==========================================================
//
// Your index.html uses this endpoint.
//
// /api/dashboard
//
// ==========================================================

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


// ==========================================================
// API: BOT INFORMATION
// ==========================================================

app.get(
    "/api/bot",
    (req, res) => {

        res.json({

            name:
                "Lyra",

            clientId:
                DISCORD_CLIENT_ID,

            permissions:
                LYRA_PERMISSIONS,

            commands:
                25,

            status:
                "online"

        });

    }
);


// ==========================================================
// LOGOUT
// ==========================================================

app.get(
    "/auth/logout",
    (req, res) => {

        const username =
            req.session.user
                ? req.session.user.username
                : "Unknown";


        req.session.destroy(
            error => {

                if (error) {

                    console.error(
                        "❌ Logout error:",
                        error
                    );


                    return res.status(
                        500
                    ).send(
                        "Could not log out."
                    );

                }


                res.clearCookie(
                    "lyra.sid"
                );


                console.log(
                    `👋 ${username} logged out.`
                );


                res.redirect(
                    "/?logout=success"
                );

            }
        );

    }
);


// ==========================================================
// HEALTH CHECK
// ==========================================================
//
// Useful for Render.
//
// Open:
//
// /health
//
// ==========================================================

app.get(
    "/health",
    (req, res) => {

        res.status(
            200
        ).json({

            status:
                "online",

            service:
                "Lyra Support",

            uptime:
                process.uptime(),

            timestamp:
                new Date().toISOString()

        });

    }
);


// ==========================================================
// 404
// ==========================================================

app.use(
    (req, res) => {

        // API 404

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(
                404
            ).json({

                error:
                    "API endpoint not found."

            });

        }


        // Website 404

        res.status(
            404
        ).sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// ==========================================================
// ERROR HANDLER
// ==========================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.error(
            "❌ EXPRESS ERROR"
        );

        console.error(
            error
        );

        console.error(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(
                500
            ).json({

                error:
                    "Internal server error."

            });

        }


        res.status(
            500
        ).send(
            "Lyra encountered an internal server error."
        );

    }
);


// ==========================================================
// START SERVER
// ==========================================================

checkEnvironment();


app.listen(
    PORT,
    () => {

        console.log(
            ""
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "🌙 LYRA SUPPORT WEBSITE"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        console.log(
            `📁 Serving: ${path.join(
                __dirname,
                "public"
            )}`
        );

        console.log(
            `🌐 Website: http://localhost:${PORT}`
        );

        console.log(
            `🔵 Login: http://localhost:${PORT}/auth/discord`
        );

        console.log(
            `❤️ Health: http://localhost:${PORT}/health`
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "✨ LYRA WEBSITE ONLINE"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

    }
);
