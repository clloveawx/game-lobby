module.exports = function(schema, options) {
    schema.add({lastMod: Date});

    schema.pre('save', function(next) {
        var modifiedPaths = this.modifiedPaths();
        if ((modifiedPaths.length > 1)
            || (modifiedPaths.length == 1 && modifiedPaths[0] != "lastMod")) {
            this.lastMod = new Date;
        }
        next();
    });

    if (options && options.index) {
        schema.path('lastMod').index(options.index);
    }
};
