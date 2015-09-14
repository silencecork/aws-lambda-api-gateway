var im = require('imagemagick');
var fs = require('fs');


var postProcessResource = function(resource, fn) {
    var ret = null;
    if (resource) {
        if (fn) {
            ret = fn(resource);
        }
        try {
            fs.unlinkSync(resource);
        } catch (err) {
            // Ignore
        }
    }
    return ret;
};


var identify = function(event, context) {
    if (!event.base64Image) {
        var msg = 'Invalid identify request: no "base64Image" field supplied';
        console.log(msg);
        context.fail(msg);
        return;
    }
    var tmpFile = "/tmp/inputFile." + (event.inputExtension || 'png');
    var buffer = new Buffer(event.base64Image, 'base64');
    fs.writeFileSync(tmpFile, buffer);
    var args = event.customArgs ? event.customArgs.concat([tmpFile]) : tmpFile;
    im.identify(args, function(err, output) {
        fs.unlinkSync(tmpFile);
        if (err) {
            console.log('Identify operation failed:', err);
            context.fail(err);
        } else {
            console.log('Identify operation completed successfully');
            context.succeed(output);
        }
    });
};

var resize = function(event, context) {
    if (!event.base64Image) {
        var msg = 'Invalid resize request: no "base64Image" field supplied';
        console.log(msg);
        context.fail(msg);
        return;
    }
    // If neither height nor width was provided, turn this into a thumbnailing request
    if (!event.height && !event.width) {
        event.width = 100;
    }
    var resizedFile = "/tmp/resized." + (event.outputExtension || 'png');
    var buffer = new Buffer(event.base64Image, 'base64');
    delete event.base64Image;
    delete event.outputExtension;
    event.srcData = buffer;
    event.dstPath = resizedFile;
    try {
        im.resize(event, function(err, stdout, stderr) {
            if (err) {
                throw err;
            } else {
                console.log('Resize operation completed successfully');
                context.succeed(postProcessResource(resizedFile, function(file) {
                    return new Buffer(fs.readFileSync(file)).toString('base64');
                }));
            }
        });
    } catch (err) {
        console.log('Resize operation failed:', err);
        context.fail(err);
    }
};

var convert = function(event, context) {
    event.customArgs = event.customArgs || [];
    var inputFile = null;
    var outputFile = null;
    if (event.base64Image) {
        inputFile = "/tmp/inputFile." + (event.inputExtension || 'png');
        var buffer = new Buffer(event.base64Image, 'base64');
        fs.writeFileSync(inputFile, buffer);
        event.customArgs.unshift(inputFile);
    }
    if (event.outputExtension) {
        outputFile = "/tmp/outputFile." + event.outputExtension;
        event.customArgs.push(outputFile);
    }
    im.convert(event.customArgs, function(err, output) {
        if (err) {
            console.log('Convert operation failed:', err);
            context.fail(err);
        } else {
            console.log('Convert operation completed successfully');
            postProcessResource(inputFile);
            if (outputFile) {
                context.succeed(postProcessResource(outputFile, function(file) {
                    return new Buffer(fs.readFileSync(file)).toString('base64');
                }));
            } else {
                // Return the command line output as a debugging aid
                context.succeed(output);
            }
        }
    });
};


exports.handler = function(event, context) {
    var operation = event.operation;
    delete event.operation;
    if (operation) {
        console.log('Operation', operation, 'requested');
    }

    switch (operation) {
        case 'ping':
            context.succeed('pong');
            break;
        case 'getDimensions':
            event.customArgs = ['-format', '%wx%h'];
            // Intentional fall-through
        case 'identify':
            identify(event, context);
            break;
        case 'thumbnail':  // Synonym for resize
        case 'resize':
            resize(event, context);
            break;
        case 'getSample':
            event.customArgs = ['rose:'];
            event.outputExtension = event.outputExtension || 'png';
            // Intentional fall-through
        case 'convert':
            convert(event, context);
            break;
        default:
            context.fail(new Error('Unrecognized operation "' + operation + '"'));
    }
};