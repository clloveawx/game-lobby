module.exports = function(schema, options) {
    schema.add({createAt: {type: Date, default: Date.now}});

    schema.pre('save', function(next) {
        if (!this.isNew && this.isModified('createAt'))
            delete this.createAt;
        next();
    });

    if (options && options.index) {
        schema.path('createAt').index(options.index);
    }
};
