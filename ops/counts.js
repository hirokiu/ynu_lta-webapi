var counts = {};
db.getCollectionNames().sort().forEach(function(name) { if (name.indexOf('system.') !== 0) counts[name] = db.getCollection(name).countDocuments({}); });
print(JSON.stringify(counts));
