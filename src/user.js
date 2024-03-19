

class User extends Realm.Object {
	static schema = {
		name: "user",
		properties: {
			_id: { type: "objectId", default: () => new Realm.BSON.ObjectId() },
			userType: {type: "int", default: 0},
			login: "login",
			dashboard: "dashboard?",
		},
		primaryKey: "_id",
	};
}

class Login extends Realm.Object {
	static schema = {
		name: "login",
		embedded: true,
		properties: {
			email: "string",
			password: "string?",
			mobileNumber: "string?",
			isSignedUp: "bool",
			facebookId: "string?",
			googleId: "string?",
		},
	};
}

class Dashboard extends Realm.Object {
	static schema = {
		name: "dashboard",
		embedded: true,
		properties: {
			basicInfo: "basicInfo",
			interests: "string[]",
			favoriteGenre: "string?",
			membershipStatus: "string",
			promotionalOffers: "string[]",
			rewardPoints: {type: "int", default: 0},
			paymentDetails: "paymentDetails[]",
		},
	};
}

class BasicInfo extends Realm.Object {
	static schema = {
		name: "basicInfo",
		embedded: true,
		properties: {
			firstName: "string",
			lastName: "string",
			email: "string",
			mobileNumber: "string",
		},
	};
}

class PaymentDetails extends Realm.Object {
	static schema = {
		name: "paymentDetails",
		embedded: true,
		properties: {
			type: "string",
			cardNumber: "string",
			expiryDate: "string",
			cvv: "string",
		},
	};
}