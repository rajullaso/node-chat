var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var session = require('express-session');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/';
var userDAO = require('./dao/UserDAO').UserDAO;
var messageDAO = require('./dao/MessageDAO').MessageDAO;

// == INICIALIZA LA CONEXIÓN A MONGODB Y EL SERVIDOR
const mongodbURL = new MongoClient(url, { useUnifiedTopology: true });

mongodbURL.connect(function(err, mondb) {
    var db = mondb.db("chatSS");
    var usersDAO = new userDAO(db);
    var messagesDAO = new messageDAO(db);
    var onlineUsers = [];

    if (err) throw err;

    app.use(bodyParser.json());

    app.use(bodyParser.urlencoded({
        extended: true
    })); // Para acceder a 'req.body' en peticiones POST

    app.use(session({
        name: 'tu sesion',
        secret: 'Se le nota en la voz, por dentro es de colores, y le sobra el valor que le faltan a mis noches.',
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000,
            // You can't access these tokens in the client's javascript
            httpOnly: true,
            // Forces to use https in production
            secure: process.env.NODE_ENV === 'production' ? true : false,
            // Force the session identifier cookie to be set on every response
        },
        rolling: true
    }))

    // == CONFIGURACIÓN DE RUTAS
    app.get('/signup', function(req, res) {
        res.sendFile(__dirname + '/views/signup.html');
    });

    app.post('/signup', function(req, res) {
        var post = req.body;
        var session = req.sessionID;

        usersDAO.addUser(post, session, function(err, user) {
            if (err) {
                res.send({ 'error': true, 'err': err });
            } else {
                user.password = null;
                res.send({ 'error': false, 'user': user });
            }
        });
    });

    app.post('/', function(req, res) {
        var requestID = req.sessionID;
        console.log(requestID);

        usersDAO.validateSession(requestID, function(err, user) {
            if (err) {
                res.send({ 'error': true, 'err': err });
            } else {
                res.send({ 'error': false, 'user': user });
            }
        });
    });

    app.post('/updateUser', function(req, res) {
        var username = req.body.username;
        var newName = req.body.name;
        var newLastName = req.body.lastName;
        var newEmail = req.body.email;
        var newPassword = req.body.newPassword;
        var repNewPassword = req.body.repNewPassword;

        if (newPassword != repNewPassword) {
            console.log('Los passwords no coinciden');
        } else {
           usersDAO.updateUser(username, newName, newLastName, newEmail, newPassword, function(err, user) {
            if (err) {
                res.send({ 'error': true, 'err': err });
            } else {
                res.send({ 'error': false, 'user': user });
            }
        }); 
        }
    });

    app.post('/login', function(req, res) {
        //uso de las sesiones para llevar los logins
        var username = req.body.username;
        var password = req.body.password;
        var sessionID = req.sessionID;

        usersDAO.validateLogin(username, password, sessionID, function(err, user) {
            if (err) {
                res.send({ 'error': true, 'err': err });
            } else {
                res.send({ 'error': false, 'user': user });
            }
        });
    });

    /** css and js static routes */
    app.get('/css/foundation.min.css', function(req, res) {
        res.sendFile(__dirname + '/views/css/foundation.min.css');
    });

    app.get('/css/normalize.css', function(req, res) {
        res.sendFile(__dirname + '/views/css/normalize.css');
    });

    app.get('/css/chat.css', function(req, res) {
        res.sendFile(__dirname + '/views/css/chat.css');
    });

    app.get('/css/main.css', function(req, res) {
        res.sendFile(__dirname + '/views/css/main.css');
    });

    app.get('/css/style.css', function(req, res) {
        res.sendFile(__dirname + '/views/css/style.css');
    });

    app.get('/js/foundation.min.js', function(req, res) {
        res.sendFile(__dirname + '/views/js/foundation.min.js');
    });

    app.get('/js/foundation.offcanvas.js', function(req, res) {
        res.sendFile(__dirname + '/views/js/foundation.offcanvas.js');
    });

    app.get('/js/chat.js', function(req, res) {
        res.sendFile(__dirname + '/views/js/chat.js');
    });

    app.get('/js/moment-with-locales.min.js', function(req, res) {
        res.sendFile(__dirname + '/views/js/moment-with-locales.min.js');
    });

    app.get('/js/main.js', function(req, res) {
        res.sendFile(__dirname + '/views/js/main.js');
    });

    app.get('/img/cevLogo.png', function(req, res) {
        res.sendFile(__dirname + '/views/img/cevLogo.png');
    });

    app.get('/img/nathan.png', function(req, res) {
        res.sendFile(__dirname + '/views/img/nathan.png');
    });

    app.get('/videoChat', function(req, res) {
        res.sendFile(__dirname + '/views/videoChat.html');
    });

    app.get('*', function(req, res) {
        res.sendFile(__dirname + '/views/chat.html');
    });

    /** *** *** ***
     *  Configuramos Socket.IO para estar a la escucha de
     *  nuevas conexiones. 
     */
    io.on('connection', function(socket) {

        console.log('New user connected');

        /**
         * Cuando un cliente se conecta, emite este evento
         * para informar al resto de usuarios que se ha conectado.
         * @param  {[type]} nuser El nuevo usuarios
         */
        socket.on('new user', function(nuser) {
            socket.user = nuser;
            onlineUsers.push(nuser);
            io.emit('new user', nuser);
        });

        /**
         * Cada nuevo cliente solicita con este evento la lista
         * de usuarios conectados en el momento.
         */
        socket.on('all online users', function() {
            io.emit('all online users', onlineUsers);
        });

        /**
         * Cada nuevo socket debera estar a la escucha
         * del evento 'chat message', el cual se activa
         * cada vez que un usuario envia un mensaje.
         * 
         * @param  msg : Los datos enviados desde el cliente a 
         *               través del socket.
         */
        socket.on('chat message', function(msg) {
            messagesDAO.addMessage(msg.username, Date.now(), msg.message, function(err, nmsg) {
                io.emit('chat message', nmsg);
            });
        });

        /**
         * Mostramos en consola cada vez que un usuario
         * se desconecte del sistema.
         */
        socket.on('disconnect', function() {
            onlineUsers.splice(onlineUsers.indexOf(socket.user), 1);
            io.emit('remove user', socket.user);
            console.log('User disconnected');
        });

        /**
         * Cada nuevo cliente solicita mediante este evento
         * los ultimos mensajes registrados en el historial
         */
        socket.on('latest messages', function() {
            messagesDAO.getLatest(50, function(err, messages) {
                if (err) console.log('Error getting messages from history');
                io.emit('latest messages', messages);
            });
        });

    });

    /**
     * Iniciamos la aplicación en el puerto 80
     */
    http.listen(3000, function() {
        console.log('¡Alumni Chat en marcha!');
    });
});