// db.js
const { MongoClient } = require("mongodb");

const url = "mongodb://localhost:27017";
const dbName = "testdb";

let client = null;

async function connect() {
  if (client) return client.db(dbName);

  client = new MongoClient(url);
  await client.connect();
  console.log("Connected successfully to server");

  return client.db(dbName);
}

async function getCollection(collectionName) {
  const database = await connect();
  return database.collection(collectionName);
}

async function startSession() {
  if (!client) await connect();
  return client.startSession();
}

async function readData(collectionName, query = {}) {
  const collection = await getCollection(collectionName);
  return collection.find(query).toArray();
}

async function writeData(collectionName, data) {
  const collection = await getCollection(collectionName);
  if (Array.isArray(data)) {
    return collection.insertMany(data);
  } else {
    return collection.insertOne(data);
  }
}

// async function updateData(collectionName, filter, update) {
//   const collection = await getCollection(collectionName);
//   return collection.updateMany(filter, { $set: update });
// }

async function updateData(collectionName, filter, update, options = {}) {
  const collection = await getCollection(collectionName);
  return collection.updateMany(filter, update, options);
}

async function deleteData(collectionName, filter = {}) {
  const collection = await getCollection(collectionName);
  return collection.deleteMany(filter);
}

module.exports = {
  connect,
  getCollection,
  startSession,
  readData,
  writeData,
  updateData,
  deleteData,
};
