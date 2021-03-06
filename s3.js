var AWS = require('aws-sdk');
var utils = require('./utils.js');
var settings = require('./settings.js');
//Setup AWS credentials for S3
var s3AccessKey = settings.s3.accessKey;
var s3SecretAccessKey = settings.s3.secretAccessKey;
var s3BucketName = settings.s3.bucketName;
var s3Region = settings.s3.region;
var s3Endpoint = settings.s3.endPoint;
if(s3AccessKey === '' || s3SecretAccessKey === '' || s3BucketName === '' || s3Region === '' || s3Endpoint === '') {
	throw new ReferenceError('There was a problem locating the AWS S3 settings, check your settings file.');
}
var s3 = new AWS.S3({
	accessKeyId: s3AccessKey,
	secretAccessKey: s3SecretAccessKey,
	sslEnabled: true,
	region: s3Region
});
if(s3 === undefined) {
	throw new ReferenceError('Unable to find the S3 Module, please make sure aws-sdk is installed.');
}

var S3 = function() {}

/**
 * Takes the UID and gets the object from S3
 * @param  {string}   uid      The unique id of the request
 * @param  {Function} callback The callback to send the data back up
 * @return {Function} callback ^
 */
exports.status = function (uuid, callback) {
	try {
		// Check and sanitize input
		var uuid = utils.checkInput(utils.sanitizeInput(uuid, 'string'), 'UUID');
		var getOptions = {
			Bucket: s3BucketName,
			Key: uuid
		};
		// Get object from S3
		// TODO version checking
		s3.getObject(getOptions, function (error, data) {
			if(error) {
				return callback(error.message);
			}
			var data = JSON.parse(new Buffer(data.Body));
			return callback(null, data);
		});
	} catch(e) {
		return callback(e.message);
	}
};

/**
 * Stores the S3 request from the user
 * @param  {Object}   request  The object coming from the scanner {host: "", ports: [], uuid: ""}
 * @param  {Function} callback The callback to send the data back up
 * @return {Function} callback ^
 */
exports.storeRequest = function (request, UUID, callback) {
	var putOptions = {
		Bucket: s3BucketName,
		Key: UUID,
		Body: JSON.stringify(request),
		ServerSideEncryption: 'AES256'
	};
	s3.putObject(putOptions, function (error, data) {
		if(error) {
			return callback(error.message);
		}
		return callback(null, {uuid: UUID});
	});
};

exports.getRegistration = function (email, callback) {
	var getOptions = {
		Bucket: s3BucketName,
		Key: 'apiKeys/' + email
	};
	s3.getObject(getOptions, function (error, data) {
		if(error) {
			return callback(error.message);
		}
		return callback(null, data);
	});
};

exports.storeRegistration = function (registerObj, email, callback) {
	var putOptions = {
		Bucket: s3BucketName,
		Key: 'apiKeys/' + email,
		Body: JSON.stringify(registerObj),
		ServerSideEncryption: 'AES256'
	};
	s3.putObject(putOptions, function (error, data) {
		if(error) {
			return callback(error.message);
		}
		return callback(null, {message: 'Success', APIkey: registerObj.APIkey});
	});
};

return S3;