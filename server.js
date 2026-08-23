// ============================================================
// 🌙 LYRA SUPPORT WEBSITE
// Discord OAuth2 + Dashboard + Server Management
// ============================================================

const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");

// ============================================================
// APP
// ============================================================

const app = express();

// Render provides PORT.
// Locally we use 3000.
const PORT = Number(process.env.PORT) || 3000;

// Render requires the server to listen on 0.0.0.0.
const HOST = "0.0.0.0";

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const CLIENT_ID =
    process.env.DISCORD_CLIENT_ID;

const CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET;

const REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    "https://lyrasupport.onrender.com/auth/discord/callback";

const SESSION_SECRET =
    process.env.SESSION_SECRET;

const BOT_PERMISSIONS =
    process.env.LYRA_PERMISSIONS || "0";


// ============================================================
// CONSTANTS
// ============================================================

const DISCORD_API =
    "https://discord.com/api/v10";

const DISCORD_OAUTH =
    "https://discord.com/oauth2/authorize";

const DISCORD_TOKEN =
    "https://discord.com/api/oauth2/token";

const PUBLIC_FOLDER =
    path.join(__dirname, "public");


// ============================================================
// SECURITY / EXPRESS SETTINGS
// ============================================================

app.disable("x-powered-by");

// Render is behind a proxy.
app.set("trust proxy", 1);


// ============================================================
// BODY PARSING
// ============================================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


// ============================================================
// SESSION
// ============================================================

if (!SESSION_SECRET) {

    console.warn(
        "⚠️ SESSION_SECRET is not configured."
    );

    console.warn(
        "⚠️ A temporary secret will be generated."
    );

    console.warn(
        "⚠️ Users may be logged out when the server restarts."
    );
}

const sessionSecret =
    SESSION_SECRET ||
    crypto.randomBytes(64).toString("hex");


app.use(
    session({

        name: "lyra.sid",

        secret: sessionSecret,

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


// ============================================================
// STATIC WEBSITE
// ============================================================
//
// Your folder:
//
// public/
//   index.html
//   style.css
//
// This makes:
//
// /
// /index.html
// /style.css
//
// work automatically.
// ============================================================

app.use(
    express.static(
        PUBLIC_FOLDER,
        {

            extensions: [
                "html"
            ],

            index: "index.html"

        }
    )
);


// ============================================================
// STARTUP CONFIGURATION LOG
// ============================================================

console.log("");
console.log("============================================================");
console.log("🌙 LYRA SUPPORT SERVER");
console.log("============================================================");

console.log(
    `📁 Public folder: ${PUBLIC_FOLDER}`
);

console.log(
    `🌐 Redirect URI: ${REDIRECT_URI}`
);

console.log(
    `🆔 Client ID: ${
        CLIENT_ID
            ? "CONFIGURED"
            : "MISSING"
    }`
);

console.log(
    `🔐 Client Secret: ${
        CLIENT_SECRET
            ? "CONFIGURED"
            : "MISSING"
    }`
);

console.log(
    `🍪 Session Secret: ${
        SESSION_SECRET
            ? "CONFIGURED"
            : "MISSING"
    }`
);

console.log(
    `🤖 Bot Permissions: ${BOT_PERMISSIONS}`
);

console.log("============================================================");


// ============================================================
// CONFIGURATION CHECK
// ============================================================

function configurationIsValid() {

    return (
        Boolean(CLIENT_ID) &&
        Boolean(CLIENT_SECRET) &&
        Boolean(SESSION_SECRET)
    );

}


// ============================================================
// DISCORD API REQUEST
// ============================================================

async function discordFetch(
    endpoint,
    options = {}
) {

    const response =
        await fetch(
            `${DISCORD_API}${endpoint}`,
            {

                ...options,

                headers: {

                    "User-Agent":
                        "LyraSupport/1.0",

                    ...(options.headers || {})

                }

            }
        );


    let data = null;

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


// ============================================================
// DISCORD USER
// ============================================================

async function getDiscordUser(
    accessToken
) {

    return discordFetch(
        "/users/@me",
        {

            headers: {

                Authorization:
                    `Bearer ${accessToken}`

            }

        }
    );

}


// ============================================================
// DISCORD GUILDS
// ============================================================

async function getDiscordGuilds(
    accessToken
) {

    return discordFetch(
        "/users/@me/guilds",
        {

            headers: {

                Authorization:
                    `Bearer ${accessToken}`

            }

        }
    );

}


// ============================================================
// AVATAR URL
// ============================================================

function getAvatarURL(user) {

    if (
        !user ||
        !user.id
    ) {

        return "https://cdn.discordapp.com/embed/avatars/0.png";

    }


    if (user.avatar) {

        return (
            `https://cdn.discordapp.com/avatars/` +
            `${user.id}/` +
            `${user.avatar}.png?size=256`
        );

    }


    // Discord's modern users may not always have
    // a useful discriminator.
    //
    // Use a deterministic fallback.

    let index = 0;

    try {

        index =
            Number(
                BigInt(user.id) % 5n
            );

    } catch {

        index = 0;

    }


    return (
        `https://cdn.discordapp.com/embed/avatars/${index}.png`
    );

}


// ============================================================
// SERVER ICON URL
// ============================================================

function getGuildIconURL(guild) {

    if (
        !guild ||
        !guild.id ||
        !guild.icon
    ) {

        return "https://cdn.discordapp.com/embed/avatars/0.png";

    }


    return (
        `https://cdn.discordapp.com/icons/` +
        `${guild.id}/` +
        `${guild.icon}.png?size=256`
    );

}


// ============================================================
// DISCORD PERMISSION FLAGS
// ============================================================
//
// Administrator = 0x00000008
// Manage Guild = 0x00000020
//
// Discord permissions are bit fields.
// BigInt is used so large permission values
// are handled safely.
// ============================================================

const ADMINISTRATOR =
    1n << 3n;

const MANAGE_GUILD =
    1n << 5n;


// ============================================================
// SERVER PERMISSIONS
// ============================================================

function getServerPermissions(guild) {

    let permissions = 0n;


    try {

        permissions =
            BigInt(
                guild.permissions || "0"
            );

    } catch {

        permissions = 0n;

    }


    const isOwner =
        guild.owner === true;


    const isAdministrator =
        (
            permissions &
            ADMINISTRATOR
        ) !== 0n;


    const canManageServer =
        (
            permissions &
            MANAGE_GUILD
        ) !== 0n;


    const canInvite =
        isOwner ||
        isAdministrator ||
        canManageServer;


    let permissionType =
        "member";


    let permissionLabel =
        "Member";


    if (isOwner) {

        permissionType =
            "owner";

        permissionLabel =
            "Owner";

    }

    else if (isAdministrator) {

        permissionType =
            "administrator";

        permissionLabel =
            "Administrator";

    }

    else if (canManageServer) {

        permissionType =
            "manager";

        permissionLabel =
            "Manage Server";

    }


    return {

        owner:
            isOwner,

        administrator:
            isAdministrator,

        manageGuild:
            canManageServer,

        canInvite,

        permissionType,

        permissionLabel

    };

}


// ============================================================
// CREATE LYRA INVITE
// ============================================================

function createBotInvite(guildId) {

    if (!CLIENT_ID) {

        return null;

    }


    const params =
        new URLSearchParams({

            client_id:
                CLIENT_ID,

            permissions:
                String(
                    BOT_PERMISSIONS
                ),

            scope:
                "bot applications.commands",

            guild_id:
                guildId

        });


    return (
        `${DISCORD_OAUTH}?${params.toString()}`
    );

}


// ============================================================
// FORMAT USER
// ============================================================

function formatUser(user) {

    return {

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

}


// ============================================================
// FORMAT SERVER
// ============================================================

function formatGuild(guild) {

    const permissions =
        getServerPermissions(
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
                ? createBotInvite(
                    guild.id
                )
                : null

    };

}


// ============================================================
// SAVE SESSION
// ============================================================

function saveSession(
    req
) {

    return new Promise(
        (resolve, reject) => {

            req.session.save(
                error => {

                    if (error) {

                        reject(
                            error
                        );

                        return;

                    }

                    resolve();

                }
            );

        }
    );

}


// ============================================================
// DESTROY SESSION
// ============================================================

function destroySession(
    req
) {

    return new Promise(
        (resolve, reject) => {

            req.session.destroy(
                error => {

                    if (error) {

                        reject(
                            error
                        );

                        return;

                    }

                    resolve();

                }
            );

        }
    );

}


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            status:
                "online",

            service:
                "Lyra Support",

            environment:
                process.env.NODE_ENV ||
                "development",

            render:
                Boolean(
                    process.env.RENDER
                ),

            uptime:
                Math.floor(
                    process.uptime()
                ),

            timestamp:
                new Date().toISOString()

        });

    }
);


// ============================================================
// WEBSITE STATUS
// ============================================================

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            online:
                true,

            bot:
                "Lyra",

            website:
                "Lyra Support",

            oauthConfigured:
                Boolean(
                    CLIENT_ID &&
                    CLIENT_SECRET
                ),

            sessionConfigured:
                Boolean(
                    SESSION_SECRET
                ),

            timestamp:
                new Date().toISOString()

        });

    }
);


// ============================================================
// DISCORD LOGIN
// ============================================================

app.get(
    "/auth/discord",
    (req, res) => {

        if (
            !CLIENT_ID ||
            !CLIENT_SECRET
        ) {

            console.error(
                "❌ OAuth configuration missing."
            );


            return res
                .status(500)
                .send(
                    "Discord OAuth is not configured. Check Render environment variables."
                );

        }


        // ----------------------------------------------------
        // CREATE STATE
        // ----------------------------------------------------

        const state =
            crypto.randomBytes(
                32
            ).toString(
                "hex"
            );


        req.session.oauthState =
            state;


        // ----------------------------------------------------
        // OPTIONAL RETURN URL
        // ----------------------------------------------------

        let returnTo = "/";


        if (
            typeof req.query.returnTo ===
            "string"
        ) {

            const requested =
                req.query.returnTo;


            // Only allow internal paths.
            // This prevents open redirect attacks.

            if (
                requested.startsWith("/") &&
                !requested.startsWith("//")
            ) {

                returnTo =
                    requested;

            }

        }


        req.session.oauthReturnTo =
            returnTo;


        // ----------------------------------------------------
        // DISCORD OAUTH PARAMETERS
        // ----------------------------------------------------

        const params =
            new URLSearchParams({

                client_id:
                    CLIENT_ID,

                redirect_uri:
                    REDIRECT_URI,

                response_type:
                    "code",

                scope:
                    "identify guilds",

                state

            });


        const url =
            `${DISCORD_OAUTH}?${params.toString()}`;


        console.log("");
        console.log(
            "🔵 DISCORD LOGIN STARTED"
        );
        console.log(
            `↪ Redirect: ${REDIRECT_URI}`
        );


        res.redirect(
            url
        );

    }
);


// ============================================================
// DISCORD CALLBACK
// ============================================================

app.get(
    "/auth/discord/callback",
    async (req, res) => {

        console.log("");
        console.log(
            "============================================================"
        );

        console.log(
            "🌙 DISCORD OAUTH CALLBACK"
        );

        console.log(
            "============================================================"
        );


        try {

            // ------------------------------------------------
            // READ QUERY
            // ------------------------------------------------

            const code =
                typeof req.query.code ===
                "string"
                    ? req.query.code
                    : null;


            const state =
                typeof req.query.state ===
                "string"
                    ? req.query.state
                    : null;


            const oauthError =
                typeof req.query.error ===
                "string"
                    ? req.query.error
                    : null;


            const errorDescription =
                typeof req.query.error_description ===
                "string"
                    ? req.query.error_description
                    : null;


            console.log(
                `Code: ${
                    code
                        ? "RECEIVED"
                        : "MISSING"
                }`
            );


            console.log(
                `State: ${
                    state
                        ? "RECEIVED"
                        : "MISSING"
                }`
            );


            // ------------------------------------------------
            // DISCORD CANCELLED
            // ------------------------------------------------

            if (oauthError) {

                console.warn(
                    `⚠️ Discord OAuth error: ${oauthError}`
                );


                if (
                    errorDescription
                ) {

                    console.warn(
                        `Description: ${errorDescription}`
                    );

                }


                return res.redirect(
                    "/?login=cancelled"
                );

            }


            // ------------------------------------------------
            // CODE REQUIRED
            // ------------------------------------------------

            if (!code) {

                console.error(
                    "❌ Discord did not send an OAuth code."
                );


                return res
                    .status(400)
                    .send(
                        "Discord did not provide an authorization code."
                    );

            }


            // ------------------------------------------------
            // STATE REQUIRED
            // ------------------------------------------------

            if (!state) {

                console.error(
                    "❌ Missing OAuth state."
                );


                return res
                    .status(400)
                    .send(
                        "Missing OAuth state. Please try logging in again."
                    );

            }


            // ------------------------------------------------
            // SESSION STATE
            // ------------------------------------------------

            const savedState =
                req.session.oauthState;


            if (
                !savedState
            ) {

                console.error(
                    "❌ No OAuth state exists in session."
                );


                return res
                    .status(403)
                    .send(
                        "Your login session expired. Please return to Lyra and try again."
                    );

            }


            // ------------------------------------------------
            // VERIFY STATE
            // ------------------------------------------------

            if (
                state !==
                savedState
            ) {

                console.error(
                    "❌ OAuth state mismatch."
                );


                return res
                    .status(403)
                    .send(
                        "Invalid OAuth state. Please try logging in again."
                    );

            }


            // State can only be used once.

            delete req.session.oauthState;


            // ------------------------------------------------
            // EXCHANGE CODE
            // ------------------------------------------------

            console.log(
                "🔄 Exchanging OAuth code..."
            );


            const tokenResponse =
                await fetch(
                    DISCORD_TOKEN,
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

                                code:
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
                    "❌ Discord token exchange failed."
                );

                console.error(
                    tokenData
                );


                return res
                    .status(500)
                    .send(
                        "Discord authorization could not be completed."
                    );

            }


            const accessToken =
                tokenData.access_token;


            if (!accessToken) {

                console.error(
                    "❌ No access token received."
                );


                return res
                    .status(500)
                    .send(
                        "Discord did not return an access token."
                    );

            }


            console.log(
                "✅ Access token received."
            );


            // ------------------------------------------------
            // GET USER
            // ------------------------------------------------

            console.log(
                "👤 Getting Discord user..."
            );


            const discordUser =
                await getDiscordUser(
                    accessToken
                );


            console.log(
                `👤 Logged in as: ${discordUser.username}`
            );


            // ------------------------------------------------
            // GET GUILDS
            // ------------------------------------------------

            console.log(
                "🌐 Getting Discord servers..."
            );


            const discordGuilds =
                await getDiscordGuilds(
                    accessToken
                );


            console.log(
                `🌐 Servers received: ${discordGuilds.length}`
            );


            // ------------------------------------------------
            // FORMAT DATA
            // ------------------------------------------------

            const user =
                formatUser(
                    discordUser
                );


            const guilds =
                discordGuilds
                    .map(
                        formatGuild
                    )
                    .sort(
                        (a, b) => {

                            // Inviteable servers first.

                            if (
                                a.canInvite &&
                                !b.canInvite
                            ) {

                                return -1;

                            }


                            if (
                                !a.canInvite &&
                                b.canInvite
                            ) {

                                return 1;

                            }


                            return a.name
                                .localeCompare(
                                    b.name
                                );

                        }
                    );


            // ------------------------------------------------
            // SAVE SESSION
            // ------------------------------------------------

            req.session.user =
                user;


            req.session.guilds =
                guilds;


            /*
            We keep the access token in the session so
            the server can make future Discord API requests.

            It is NEVER sent to the browser.
            */

            req.session.accessToken =
                accessToken;


            req.session.loggedInAt =
                Date.now();


            const returnTo =
                req.session.oauthReturnTo ||
                "/";


            delete req.session.oauthReturnTo;


            await saveSession(
                req
            );


            // ------------------------------------------------
            // LOG
            // ------------------------------------------------

            const inviteable =
                guilds.filter(
                    guild =>
                        guild.canInvite
                ).length;


            console.log("");
            console.log(
                "============================================================"
            );

            console.log(
                "✨ LYRA LOGIN SUCCESS"
            );

            console.log(
                "============================================================"
            );

            console.log(
                `👤 User: ${user.globalName}`
            );

            console.log(
                `🆔 ID: ${user.id}`
            );

            console.log(
                `🌐 Servers: ${guilds.length}`
            );

            console.log(
                `🤖 Inviteable: ${inviteable}`
            );

            console.log(
                "============================================================"
            );


            // ------------------------------------------------
            // REDIRECT
            // ------------------------------------------------

            const separator =
                returnTo.includes("?")
                    ? "&"
                    : "?";


            res.redirect(
                `${returnTo}${separator}login=success`
            );

        }

        catch (error) {

            console.error("");
            console.error(
                "============================================================"
            );

            console.error(
                "❌ DISCORD LOGIN FAILED"
            );

            console.error(
                "============================================================"
            );

            console.error(
                error
            );

            console.error(
                "============================================================"
            );


            res
                .status(500)
                .send(
                    `
                    <html>
                        <head>
                            <title>Lyra Login Error</title>
                            <style>
                                body {
                                    background:#080808;
                                    color:white;
                                    font-family:Arial,sans-serif;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    min-height:100vh;
                                    margin:0;
                                }

                                .box {
                                    max-width:600px;
                                    padding:40px;
                                    background:#111;
                                    border:1px solid #292929;
                                    border-radius:20px;
                                    text-align:center;
                                }

                                h1 {
                                    color:#8b5cf6;
                                }

                                a {
                                    display:inline-block;
                                    margin-top:20px;
                                    padding:12px 20px;
                                    background:#8b5cf6;
                                    color:white;
                                    text-decoration:none;
                                    border-radius:10px;
                                }
                            </style>
                        </head>

                        <body>

                            <div class="box">

                                <h1>
                                    🌙 Lyra Login Error
                                </h1>

                                <p>
                                    Something went wrong while
                                    connecting your Discord account.
                                </p>

                                <a href="/">
                                    Return to Lyra
                                </a>

                            </div>

                        </body>
                    </html>
                    `
                );

        }

    }
);


// ============================================================
// CURRENT USER API
// ============================================================

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


// ============================================================
// DASHBOARD API
// ============================================================
//
// Your index.html calls:
//
// GET /api/dashboard
//
// ============================================================

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
                req.session.guilds ||
                []

        });

    }
);


// ============================================================
// GUILDS API
// ============================================================

app.get(
    "/api/guilds",
    (req, res) => {

        if (
            !req.session.user
        ) {

            return res
                .status(401)
                .json({

                    loggedIn:
                        false,

                    error:
                        "Not logged in."

                });

        }


        res.json({

            success:
                true,

            guilds:
                req.session.guilds ||
                []

        });

    }
);


// ============================================================
// BOT API
// ============================================================

app.get(
    "/api/bot",
    (req, res) => {

        res.json({

            name:
                "Lyra",

            clientId:
                CLIENT_ID || null,

            commands:
                25,

            permissions:
                BOT_PERMISSIONS,

            status:
                "online",

            website:
                "https://lyrasupport.onrender.com"

        });

    }
);


// ============================================================
// SESSION API
// ============================================================

app.get(
    "/api/session",
    (req, res) => {

        res.json({

            loggedIn:
                Boolean(
                    req.session.user
                ),

            user:
                req.session.user ||
                null,

            loggedInAt:
                req.session.loggedInAt ||
                null

        });

    }
);


// ============================================================
// LOGOUT
// ============================================================

app.get(
    "/auth/logout",
    async (req, res) => {

        const username =
            req.session.user
                ? req.session.user.username
                : "Unknown";


        try {

            await destroySession(
                req
            );


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

        catch (error) {

            console.error(
                "❌ Logout failed:",
                error
            );


            res
                .status(500)
                .send(
                    "Logout failed."
                );

        }

    }
);


// ============================================================
// TEST OAUTH CONFIGURATION
// ============================================================

app.get(
    "/api/oauth-status",
    (req, res) => {

        res.json({

            clientIdConfigured:
                Boolean(
                    CLIENT_ID
                ),

            clientSecretConfigured:
                Boolean(
                    CLIENT_SECRET
                ),

            redirectConfigured:
                Boolean(
                    REDIRECT_URI
                ),

            sessionConfigured:
                Boolean(
                    SESSION_SECRET
                ),

            redirectURI:
                REDIRECT_URI,

            scopes:
                [
                    "identify",
                    "guilds"
                ]

        });

    }
);


// ============================================================
// API 404
// ============================================================

app.use(
    "/api",
    (req, res) => {

        res
            .status(404)
            .json({

                error:
                    "API route not found.",

                path:
                    req.path

            });

    }
);


// ============================================================
// WEBSITE 404
// ============================================================

app.use(
    (req, res) => {

        /*
        If someone visits a random URL,
        show the main website instead of
        Express' default "Cannot GET /".
        */

        res
            .status(404)
            .sendFile(
                path.join(
                    PUBLIC_FOLDER,
                    "index.html"
                )
            );

    }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "❌ Express error:",
            error
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

            return res
                .status(500)
                .json({

                    error:
                        "Internal server error."

                });

        }


        res
            .status(500)
            .send(
                "Lyra encountered an internal server error."
            );

    }
);


// ============================================================
// SERVER START
// ============================================================

const server =
    app.listen(
        PORT,
        HOST,
        () => {

            console.log("");
            console.log(
                "============================================================"
            );

            console.log(
                "✨ LYRA WEBSITE ONLINE"
            );

            console.log(
                "============================================================"
            );

            console.log(
                `🌐 Host: ${HOST}`
            );

            console.log(
                `🔌 Port: ${PORT}`
            );

            console.log(
                `📁 Public: ${PUBLIC_FOLDER}`
            );

            console.log(
                `🔵 Login: /auth/discord`
            );

            console.log(
                `🔁 Callback: /auth/discord/callback`
            );

            console.log(
                `❤️ Health: /health`
            );

            console.log(
                `📊 Dashboard API: /api/dashboard`
            );

            console.log(
                "============================================================"
            );

        }
    );


// ============================================================
// SERVER TIMEOUTS
// ============================================================
//
// Helps avoid connection issues on hosted environments.
// ============================================================

server.keepAliveTimeout =
    120000;

server.headersTimeout =
    125000;


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(
    signal
) {

    console.log(
        `\n🛑 ${signal} received.`
    );


    server.close(
        () => {

            console.log(
                "✅ Server closed."
            );

            process.exit(
                0
            );

        }
    );


    setTimeout(
        () => {

            console.error(
                "⚠️ Forced shutdown."
            );

            process.exit(
                1
            );

        },
        10000
    );

}


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);


// ============================================================
// UNHANDLED ERRORS
// ============================================================

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "❌ Unhandled Promise Rejection:",
            error
        );

    }
);


process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ Uncaught Exception:",
            error
        );

    }
);
