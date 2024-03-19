const {MongoClient} = require('mongodb')

let dbConnection
let uri = 'mongodb+srv://aldoub:O3v6jlh3O2zZwPbr@bookingmanagementcluste.xmjzbl9.mongodb.net/?retryWrites=true&w=majority'

module.exports = {
	connectDb: (callback) => {
	MongoClient.connect(uri)
		.then((client) => {
			dbConnection = client.db('bookingdb')
			return callback()
		})
		.catch(error => {
			console.log(error)
			return callback(error)
		})
	},
	getDb: () => dbConnection
}