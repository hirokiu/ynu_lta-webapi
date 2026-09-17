// Explicit migration: no automatic production index writes on API startup.
// Non-unique indexes avoid changing existing data constraints.
db.assignments.createIndex({userId: 1, publishAt: -1});
db.assignments.createIndex({groupId: 1, publishFrom: 1});
db.assignments.createIndex({publishAt: -1, _id: -1});
db.assignments.createIndex({publishFrom: 1, publishTo: 1});
db.assignments.createIndex({"survey._id": 1});
db.assignmentresults.createIndex({assignment: 1, userId: 1});
db.assignmentresults.createIndex({assignment: 1, lastOpenedAt: 1});
db.groups.createIndex({userIds: 1});
db.surveys.createIndex({createdAt: -1, _id: -1});
