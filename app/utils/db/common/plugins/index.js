'use strict';

const plugins = {};
plugins.createAt = require("./createAt");
plugins.lastMod = require("./lastMod");

module.exports = (schema, options) =>{
	schema.plugin(plugins.createAt, options);
	schema.plugin(plugins.lastMod, options);
};
