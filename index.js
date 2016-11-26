#!/usr/bin/env node

var fs = require('fs');
var minimist = require('minimist');
var read = require('read-components');

function fatal(err, msg) {
	console.error(msg || 'Fatal error', err);
	process.exit(1);
}

function printUsage() {
	console.log(`Usage: ${process.argv[0]} [-d <project-dir>] [-e <extension>] <output-file>`);
	console.log('Concatenate all bower components in a single file by dependency order.');
	console.log('');
	console.log('Arguments:');
	console.log('  -d <project-dir>  Directory containing bower.json file (optional, default: current directory)');
	console.log('  -e <extension>    Extension of files to concatenate (optional, default: js)');
	console.log('  <output-file>     File to generate ("-" for standard output)');
}

function FileGenerator(projectDir, outputFilePath, extension) {
	this.projectDir = projectDir;
	this.outputFilePath = outputFilePath;
	this.extension = extension;
}

FileGenerator.prototype.run = function() {
	this.createOutputFile(this.outputFilePath);
};

FileGenerator.prototype.createOutputFile = function(path) {
	try {
		if(path === '-')
			this.outputFile = process.stdout; 
		else
			this.outputFile = fs.createWriteStream(path);
	} catch(err) {
		fatal(err, 'Could not create output file');
	}

	this.outputFile.on('error', (err) => {
		fatal(`Could not write to output file`, err);
	});

	this.resolveDependencies(this.projectDir);
};

FileGenerator.prototype.resolveDependencies = function(projectDir) {
	read(projectDir, 'bower', (err, components) => {
		if(err != null)
			fatal(err, 'Could not resolve dependencies');

		this.filesPath = Array.prototype.concat.apply([], components.map(component => component.files.filter(path => path.endsWith(this.extension))));
		this.appendFile(0);
	})
};

FileGenerator.prototype.appendFile = function(index) {
	if(index === this.filesPath.length)
		this.closeOutputFile();
	else {
		var path = this.filesPath[index];

		var inputFile;
		try {
			inputFile = fs.createReadStream(path);
		} catch(err) {
			if(err != null)
				fatal(err, `Could not read file ${path}`);
		}

		inputFile.pipe(this.outputFile, {end: false});

		inputFile.on('error', (err) => {
			fatal(`Could not read input file ${path}`, err);
		});

		inputFile.on('end', () => {
			this.appendFile(index + 1);
		});
	}
};

FileGenerator.prototype.closeOutputFile = function() {
	this.outputFile.end();
	console.error(`${this.outputFilePath} generated.`);
};

var opts = minimist(process.argv.slice(2));

if(opts._.length !== 1 || opts.help) {
	printUsage();
} else {
	var projectDir = opts.d || '.';
	var outputFilePath = opts._[0];
	var extension = '.' + (opts.e || 'js');

	new FileGenerator(projectDir, outputFilePath, extension).run();
}
