const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Replace these with your Discord application credentials
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/callback';

// Bot and guild settings
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const GUILD_ID = process.env.GUILD_ID || 'YOUR_GUILD_ID';
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // optional
const SPECIAL_ROLE_ID = '1015569732532961310';
let autoRoleIds = [];
db.get('SELECT value FROM settings WHERE key = ?', ['autoRoleIds'], (err, row) => {
    if (!err && row && row.value) {
        autoRoleIds = row.value.split(',').filter(Boolean);
    } else {
        db.get('SELECT value FROM settings WHERE key = ?', ['autoRoleId'], (e2, r2) => {
            if (!e2 && r2 && r2.value) {
                autoRoleIds = [r2.value];
            }
        });
    }
});

const scopes = ['identify'];

passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: scopes
}, function(accessToken, refreshToken, profile, done) {
    loadUser(profile, done);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

function loadUser(obj, done) {
    db.get('SELECT displayName, roles FROM members WHERE id = ?', [obj.id], (err, row) => {
        if (err || !row) {
            if (row) obj.displayName = row.displayName;
            obj.isAdmin = false;
            return done(err, obj);
        }

        obj.displayName = row.displayName;
        const roleIds = row.roles ? row.roles.split(',') : [];

        if (roleIds.includes(SPECIAL_ROLE_ID) || (ADMIN_ROLE_ID && roleIds.includes(ADMIN_ROLE_ID))) {
            obj.isAdmin = true;
            return done(null, obj);
        }
        if (roleIds.length === 0) {
            obj.isAdmin = false;
            return done(null, obj);
        }

        const placeholders = roleIds.map(() => '?').join(',');
        db.all(`SELECT permissions FROM roles WHERE id IN (${placeholders})`, roleIds, (rErr, roles) => {
            if (rErr) {
                obj.isAdmin = false;
                return done(rErr, obj);
            }
            const hasAdmin = roles.some(r => (r.permissions & PermissionsBitField.Flags.Administrator) !== 0);
            obj.isAdmin = hasAdmin;
            done(null, obj);
        });
    });
}

passport.deserializeUser(loadUser);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'discord-checkin-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// --- Discord Bot Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

function updateMember(member) {
    const roles = member.roles.cache.map(r => r.id).join(',');
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) ||
        member.roles.cache.has(SPECIAL_ROLE_ID);
    db.run(
        'INSERT OR REPLACE INTO members (id, displayName, roles, isAdmin) VALUES (?, ?, ?, ?)',
        [member.id, member.displayName, roles, isAdmin ? 1 : 0]
    );
}

function setAutoRoleIds(ids) {
    autoRoleIds = ids.filter(Boolean);
    db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['autoRoleIds', autoRoleIds.join(',')]
    );
}

function assignAutoRole(member) {
    if (!autoRoleIds || autoRoleIds.length === 0) return;
    autoRoleIds.forEach(id => {
        const role = member.guild.roles.cache.get(id);
        if (role) {
            member.roles.add(role).catch(err => console.error('Failed to assign auto role', err));
        }
    });
}

client.on('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    guild.roles.cache.forEach(role => {
        db.run(
            'INSERT OR REPLACE INTO roles (id, name, permissions) VALUES (?, ?, ?)',
            [role.id, role.name, role.permissions.bitfield]
        );
    });

    await guild.members.fetch();
    guild.members.cache.forEach(member => updateMember(member));
    db.all('SELECT displayName, roles FROM members', (err, rows) => {
        if (err) {
            console.error('Error fetching roles from DB', err);
            return;
        }
        console.log('--- Stored Member Roles ---');
        rows.forEach(row => {
            const name = row.displayName || row.id;
            console.log(`${name}: ${row.roles}`);
        });
        console.log('---------------------------');
    });
});

client.on('guildMemberAdd', member => {
    updateMember(member);
    assignAutoRole(member);
});
client.on('guildMemberUpdate', (oldMember, newMember) => updateMember(newMember));
client.on('guildMemberRemove', member => {
    db.run('DELETE FROM members WHERE id = ?', [member.id]);
});

client.on('roleCreate', role => {
    db.run(
        'INSERT OR REPLACE INTO roles (id, name, permissions) VALUES (?, ?, ?)',
        [role.id, role.name, role.permissions.bitfield]
    );
});

client.on('roleUpdate', (oldRole, newRole) => {
    db.run(
        'INSERT OR REPLACE INTO roles (id, name, permissions) VALUES (?, ?, ?)',
        [newRole.id, newRole.name, newRole.permissions.bitfield]
    );
});

client.on('roleDelete', role => {
    db.run('DELETE FROM roles WHERE id = ?', [role.id]);
});

client.login(DISCORD_BOT_TOKEN).catch(err => console.error('Bot login failed', err));

const checkins = {}; // In-memory check-in data

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).send('Admins only');
}

app.get('/', (req, res) => {
    res.redirect('/announcements');
});

app.get('/announcements', (req, res) => {
    res.render('announcements', { user: req.user });
});

app.get('/attendance', ensureAdmin, (req, res) => {
    res.render('attendance', { user: req.user, checkins });
});

app.get('/status', ensureAdmin, (req, res) => {
    res.render('status', { user: req.user, checkins });
});

app.get('/auto-role', ensureAdmin, (req, res) => {
    db.all('SELECT id, name FROM roles ORDER BY name', (err, rows) => {
        const roles = rows || [];
        const selectedRoles = roles.filter(r => autoRoleIds.includes(r.id));
        res.render('autoRole', { user: req.user, roles, currentRoles: autoRoleIds, selectedRoles });
    });
});

app.post('/auto-role', ensureAdmin, (req, res) => {
    let roles = req.body.roles || req.body.role;
    if (!roles) roles = [];
    if (!Array.isArray(roles)) roles = [roles];
    setAutoRoleIds(roles);
    res.redirect('/auto-role');
});

app.get('/login', passport.authenticate('discord'));

app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    if (!req.user.isAdmin) {
        req.logout(() => {
            res.send('관리자 권한이 필요합니다.');
        });
    } else {
        res.redirect('/');
    }
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
        username: req.user.displayName || req.user.username
    };
    res.redirect('/attendance');
});

app.post('/checkout', ensureAuthenticated, (req, res) => {
    checkins[req.user.id] = {
        status: 'out',
        time: new Date(),
        username: req.user.displayName || req.user.username
    };
    res.redirect('/attendance');
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
