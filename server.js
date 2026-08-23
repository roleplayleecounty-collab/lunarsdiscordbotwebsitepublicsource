const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

const REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    "http://localhost:3000/callback";

const BOT_CLIENT_ID = CLIENT_ID;


/* =========================================================
   SESSION
   ========================================================= */

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "change-this-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);


/* =========================================================
   STATIC WEBSITE
   ========================================================= */

app.use(
    express.static(
        path.join(__dirname)
    )
);


/* =========================================================
   DISCORD OAUTH LOGIN
   ========================================================= */

app.get("/login", (req, res) => {

    const params = new URLSearchParams({
        client_id: CLIENT_ID,

        redirect_uri: REDIRECT_URI,

        response_type: "code",

        scope: "identify guilds"
    });

    res.redirect(
        `https://discord.com/oauth2/authorize?${params}`
    );
});


/* =========================================================
   CALLBACK
   ========================================================= */

app.get("/callback", async (req, res) => {

    const code = req.query.code;

    if (!code) {
        return res.redirect("/");
    }

    try {

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
                            client_id: CLIENT_ID,

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


        const token =
            await tokenResponse.json();


        if (!token.access_token) {

            console.error(token);

            return res
                .status(500)
                .send("Discord login failed.");

        }


        const headers = {
            Authorization:
                `Bearer ${token.access_token}`
        };


        /* USER */

        const userResponse =
            await fetch(
                "https://discord.com/api/users/@me",
                {
                    headers
                }
            );


        const user =
            await userResponse.json();


        /* SERVERS */

        const guildResponse =
            await fetch(
                "https://discord.com/api/users/@me/guilds",
                {
                    headers
                }
            );


        const guilds =
            await guildResponse.json();


        req.session.user = user;

        req.session.guilds = guilds;


        res.redirect("/");

    } catch (error) {

        console.error(error);

        res
            .status(500)
            .send("Something went wrong while logging in.");

    }

});


/* =========================================================
   CURRENT USER
   ========================================================= */

app.get("/api/user", (req, res) => {

    if (!req.session.user) {

        return res.json({
            loggedIn: false
        });

    }


    res.json({

        loggedIn: true,

        user: req.session.user

    });

});


/* =========================================================
   USER SERVERS
   ========================================================= */

app.get("/api/guilds", (req, res) => {

    if (!req.session.guilds) {

        return res.status(401).json({
            error: "Not logged in"
        });

    }


    const guilds =
        req.session.guilds.map(guild => {

            const permissions =
                BigInt(guild.permissions || "0");

            const ADMINISTRATOR =
                0x8n;

            const MANAGE_GUILD =
                0x20n;


            const isAdmin =
                (permissions &
                    ADMINISTRATOR) !== 0n;


            const canManage =
                (permissions &
                    MANAGE_GUILD) !== 0n;


            return {

                id: guild.id,

                name: guild.name,

                icon: guild.icon,

                owner: guild.owner,

                administrator: isAdmin,

                manageGuild: canManage,

                canInvite:
                    isAdmin ||
                    canManage ||
                    guild.owner

            };

        });


    res.json(guilds);

});


/* =========================================================
   LOGOUT
   ========================================================= */

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");

    });

});


/* =========================================================
   START
   ========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `🌙 Lyra website running on port ${PORT}`
        );

    }
);
