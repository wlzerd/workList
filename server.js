const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Replace these with your Discord application credentials
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/callback';

const scopes = ['identify'];

passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: scopes
}, function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'discord-checkin-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const checkins = {}; // In-memory check-in data

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

app.get('/', (req, res) => {
    res.redirect('/announcements');
});

app.get('/announcements', (req, res) => {
    res.render('announcements', { user: req.user });
});

app.get('/attendance', (req, res) => {
    res.render('attendance', { user: req.user, checkins });
});

app.get('/status', (req, res) => {
    res.render('status', { user: req.user, checkins });
});

app.get('/login', passport.authenticate('discord'));

app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

app.post('/checkin', ensureAuthenticated, (req, res) => {
    checkins[req.user.id] = {
        status: 'in',
        time: new Date(),
        username: req.user.username
    };
    res.redirect('/attendance');
});

app.post('/checkout', ensureAuthenticated, (req, res) => {
    checkins[req.user.id] = {
        status: 'out',
        time: new Date(),
        username: req.user.username
    };
    res.redirect('/attendance');
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
