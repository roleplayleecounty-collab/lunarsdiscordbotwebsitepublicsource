require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;


// ==========================================
// CONFIG
// ==========================================

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

const SESSION_SECRET = process.env.SESSION_SECRET;


// Render backend URL
const BACKEND_URL =
    "https://lyrasupport.onrender.com";


// Netlify frontend
const WEBSITE_URL =
    "https://lyrasupport.netlify.app";


const REDIRECT_URI =
    `${BACKEND_URL}/auth/discord/callback`;


// ==========================================
// CHECK ENV
// ==========================================

if(!CLIENT_ID){
    console.log("Missing Discord Client ID");
    process.exit(1);
}

if(!CLIENT_SECRET){
    console.log("Missing Discord Client Secret");
    process.exit(1);
}

if(!SESSION_SECRET){
    console.log("Missing Session Secret");
    process.exit(1);
}


// ==========================================
// EXPRESS
// ==========================================

app.use(express.json());

app.use(express.urlencoded({
    extended:true
}));


app.set(
    "trust proxy",
    1
);


// ==========================================
// SESSION
// ==========================================

app.use(
    session({

        secret: SESSION_SECRET,

        resave:false,

        saveUninitialized:false,

        cookie:{

            secure:true,

            httpOnly:true,

            sameSite:"lax",

            maxAge:
            1000 *
            60 *
            60 *
            24 *
            7
        }

    })
);


// ==========================================
// DISCORD LOGIN
// ==========================================

app.get(
"/auth/discord",
(req,res)=>{


const params =
new URLSearchParams({

client_id:CLIENT_ID,

redirect_uri:REDIRECT_URI,

response_type:"code",

scope:"identify guilds"

});


const url =
`https://discord.com/oauth2/authorize?${params}`;


res.redirect(url);


});


// ==========================================
// CALLBACK
// ==========================================

app.get(
"/auth/discord/callback",

async(req,res)=>{


const code=req.query.code;


if(!code){

return res.send(
"Missing Discord code"
);

}



try{


// Get token

const token =
await fetch(
"https://discord.com/api/oauth2/token",
{

method:"POST",

headers:{
"Content-Type":
"application/x-www-form-urlencoded"
},

body:
new URLSearchParams({

client_id:CLIENT_ID,

client_secret:CLIENT_SECRET,

grant_type:
"authorization_code",

code:code,

redirect_uri:
REDIRECT_URI

})

}
);



const tokenData =
await token.json();



// Get user

const userResponse =
await fetch(
"https://discord.com/api/users/@me",
{

headers:{

Authorization:
`Bearer ${tokenData.access_token}`

}

}
);


const user =
await userResponse.json();



// Get guilds

const guildResponse =
await fetch(
"https://discord.com/api/users/@me/guilds",
{

headers:{

Authorization:
`Bearer ${tokenData.access_token}`

}

}
);


const guilds =
await guildResponse.json();



// Save session

req.session.user = user;

req.session.guilds = guilds;



console.log(
"Logged in:",
user.username
);


// Back to Netlify

res.redirect(
WEBSITE_URL
);



}catch(err){

console.log(err);

res.send(
"Discord login failed"
);


}


});


// ==========================================
// API USER
// ==========================================

app.get(
"/api/me",

(req,res)=>{


if(!req.session.user){

return res.json({

loggedIn:false

});

}


res.json({

loggedIn:true,

user:req.session.user

});


});



// ==========================================
// API GUILDS
// ==========================================

app.get(
"/api/guilds",

(req,res)=>{


res.json({

guilds:
req.session.guilds || []

});


});


// ==========================================
// STATUS
// ==========================================

app.get(
"/api/status",

(req,res)=>{


res.json({

online:true,

bot:"Lyra",

website:"online"

});


});



// ==========================================
// BOT STATS
// ==========================================

app.get(
"/api/bot/stats",

(req,res)=>{


res.json({

online:true,

bot:"Lyra",

guilds:
process.env.BOT_GUILD_COUNT || 0,

members:
process.env.BOT_MEMBER_COUNT || 0

});


});



// ==========================================
// LOGOUT
// ==========================================

app.get(
"/auth/logout",

(req,res)=>{


req.session.destroy(()=>{


res.redirect(
WEBSITE_URL
);


});


});



// ==========================================
// START
// ==========================================

app.listen(
PORT,
"0.0.0.0",
()=>{


console.log(`
🌙 LYRA WEBSITE ONLINE

Website:
${WEBSITE_URL}

Backend:
${BACKEND_URL}

OAuth:
${REDIRECT_URI}

Port:
${PORT}
`);

});
