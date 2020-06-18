/* Util para encriptar el password del usuario */
var bcrypt = require('bcrypt');

/**
 * Data Access Object (DAO) para 'users',
 * Debe ser construido con un objeto conectado a la
 * base de datos
 */
function UserDAO(db) {

    /**
     * Si el constructor es llamado sin el operador 'new'
     * entonces 'this' apunta al objeto global, muestra una advertencia
     * y lo llama correctamente.
     */
    if (false == (this instanceof UserDAO)) {
        console.log('WARNING: UserDAO constructor called without "new" operator');
        return new UserDAO(db);
    }

    /* Colección 'users' en la base de datos */
    var users = db.collection('users');

    this.addUser = function(post, session, callback) {

        var username = post.username;
        var name = post.name;
        var lastName = post.lastName;
        var password = post.password;
        var email = post.email;

        // Verificamos que el usuario no exista aun
        users.findOne({ '_id': username }, function(err, user) {
            if (err) throw err;

            if (user) {
                var user_yet_exist_error = new Error('User yet exists');
                user_yet_exist_error.msg = "User yet exists"
                return callback(user_yet_exist_error, null);
            } else {
                // Generar password hash
                var salt = bcrypt.genSaltSync();
                var password_hash = bcrypt.hashSync(password, salt);

                // Crear el nuevo 'user' con los parametros dados.
                var user = { '_id': username, 'session': session, 'name': name, 'lastName': lastName, 'password': password_hash, 'email': email };

                // Insertar el nuevo usuario en la base de datos
                users.insertOne(user, function(err, result) {
                    if (err) return callback(err, null);

                    console.log('Nuevo usuario creado');
                    return callback(null, result.ops[0]);
                });
            }
        });
    }

    this.updateUser = function(username, newName, newLastName, newEmail, newPassword, callback) {

        // Generar password hash
        var salt = bcrypt.genSaltSync();
        var password_hash = bcrypt.hashSync(newPassword, salt);


        var user = { 'name': newName, 'lastName': newLastName, 'email': newEmail, 'password': password_hash };
        var id = { '_id': username, }

        users.updateOne(id, { $set: user }, function(err, res) {
            if (err) return callback(err, null)

            console.log('Usuario modificado');
        });
    }

    this.validateLogin = function(username, password, sessionID, callback) {

        users.findOne({ '_id': username }, function(err, user) {
            if (err) return callback(err, null);

            if (user) {
                if (bcrypt.compareSync(password, user.password)) {
                    console.log(users.session, ' pasa a ', sessionID);
                    users.session = sessionID;
                    callback(null, user);
                } else {
                    var invalid_password_error = new Error('Invalid password');
                    invalid_password_error.msg = 'Invalid password';
                    callback(invalid_password_error, null);
                }
            } else {
                var no_such_user_error = new Error('User not found');
                no_such_user_error.msg = 'User not found';
                callback(no_such_user_error, null);
            }
        });
    }

    this.validateSession = function(requestID, callback) {
        users.findOne({ 'session': requestID }, function(err, sessions) {
            if (err) return callback(err, null);

            if (sessions) {
                console.log(requestID, sessions.session, 'linea 87 de userDAO');
                callback(null, sessions);
            } else {
                var invalid_session_error = new Error('Sesión caducada o está en un cliente nuevo, formalice el login.');
                invalid_session_error.msg = 'Sesión caducada o está en un cliente nuevo, formalice el login.';
                callback(invalid_session_error, null);
            }
        });
    }
}

module.exports.UserDAO = UserDAO;