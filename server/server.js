//Express JS for HTTP
var express = require('express');
var qs = require('querystring');
var http = require('http');
var path = require('path');
var settings = require('../settings.js');
var register = require('./register.js');
var helmet = require('helmet');
var uuid = require('node-uuid');
var Scanner = require('../scanner.js');
var sqs = require('../sqs.js');
var s3 = require('../s3.js');
var utils = require('../utils.js');
var app = express();
var Server = function() {}

/**
 * Starts the node server
 */
exports.start = function() {
	var sslPort = settings.server.sslPort;
	var serverPort = settings.server.serverPort;
	if(sslPort === '' || serverPort === '') {
		throw new ReferenceError('Missing server settings, please edit the settings file.');
	}
	app.configure(function () {
		app.set('title', 'ErrMahPorts');
		app.set('views', __dirname + '/views');
		app.set('ip', process.env.OPENSHIFT_NODEJS_IP || "localhost");
		app.set('port', process.env.OPENSHIFT_NODEJS_PORT || serverPort);
		app.set('view engine', 'jade');
		app.use(express.methodOverride());
		app.use(express.favicon());
		app.use(express.logger('dev'));
		app.use(helmet.xframe());
		app.use(express.bodyParser());
		app.use(helmet.contentTypeOptions());
		app.use(app.router);
		app.use(express.static(path.join(__dirname, 'public')));
	});
	// development only
	if('development' == app.get('env')) {
		app.use(express.errorHandler());
	}
	this.createGets();
	http.createServer(app).listen(app.get('port'), app.get('ip'), function(){
		console.log('Express server listening on ip:' + app.get('ip') + ' port:' + app.get('port'));
	});
};

/**
 * Stops the node server for whatever reason
 */
exports.stop = function() {
	//TODO stop the server
	console.log("Server has stopped.");
};

/**
 * Creates the GET calls that we will allow by the API
 */
exports.createGets = function() {
	app.get('/', function (request, response) {
		response.send('This is the API Service for ErrMahPorts.</br> Register for an API key <a href="/register">here.</a>');
	});
	/**
	 * Request a scan for a host and specific ports
	 * Request: /scan?host=192.168.0.1&ports=80&ports=443&key=123091280391820398
	 */
	app.get('/scan', function (request, response) {
		// Create UUID for unique key
		var UUID = uuid.v4();
		// Process data to forumulate into queue object
		processSQSData(request, UUID, function (error, sqsObj) {
			if(error) {
				return response.json(500, {message: error});
			}
			// Send message to SQS
			sqs.storeMessage(sqsObj, function (error) {
				if(error) {
					return response.json(500, {message: error});
				}
				// Process data to send to S3 storage
				processS3Data(request, function (error, s3Obj) {
					if(error) {
						return response.json(500, {message: error});
					}
					// Store message in S3
					s3.storeRequest(s3Obj, UUID, function (error, data) {
						if(error) {
							return response.json(500, {message: error});
						}
						response.json(data);
					});
				});
			});
		});
	});
	/**
	 * Get status of request
	 * Request: /status?uuid=xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx
	 */
	app.get('/status', function (request, response) {
		Scanner.status(request, function (error, data) {
			if(error) {
				response.json(500, {message: error});
			}
			response.json(data);
		});
	});
	/**
	 * Register an account
	 * Request: /registerMe?firstName=foo&lastName=bar&email=foo@bar.com
	 */
	app.get('/register', function (request, response) {
		response.render('register');
	});
	app.post('/registerMe', function (request, response) {
		register(request, response);
	})
};

function processSQSData(request, UUID, callback) {
	try {
		// TODO expand to check to isURL or isIPV6Address
		var host = utils.checkInput(utils.sanitizeInput(request.query.host, 'string'), 'IPv4');
		var ports = request.query.ports;
		var key = request.query.key;
		if(ports === undefined || key === undefined) {
			return callback('Missing parameters, please try again.');
		}
		// TODO check to make sure key is valid
		var sqsSchema = require('../sqsSchema.json');
		sqsSchema.uuid = UUID;
		sqsSchema.requester = key;
		sqsSchema.input.host = host;
		sqsSchema.input.ports = ports;
		return callback(null, sqsSchema);
	} catch(e) {
		return callback(e.message);
	}
}

function processS3Data(request, callback) {
	var s3Schema = require('../s3Schema.json');
	s3Schema.input.host = request.query.host;
	s3Schema.input.ports = request.query.ports;
	return callback(null, s3Schema);
}
return Server;