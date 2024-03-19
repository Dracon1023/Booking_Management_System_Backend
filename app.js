const express = require('express')
const {connectDb, getDb} = require('./db')
const {ObjectID} = require('mongodb')
const cors = require("cors")
//initialize
const app = express()
app.use(express.json())
app.use(cors())
const bcrypt = require('bcrypt')
const {MongoClient} = require('mongodb')


// login token
const jwt = require('jsonwebtoken')

// get secret key from dev.env file
require('dotenv').config()

const secret_key = process.env.SECRET_KEY
const expiresIn = process.env.EXPIRES_IN

// middleware for jwt
const authenticateJWT = (req, res, next) => {
	console.log("hey");
	const token = req.headers.authorization
	if (token == null) return res.sendStatus(401)
	jwt.verify(token, secret_key, (err, user) => {
		if (err) {
			console.log(err)
			return res.sendStatus(403)
		}
		req.user = user
		next()
	})
}

//connection to db
let db

connectDb((error) => {
	if (!error) {
		app.listen(80, () => {
			console.log('backend app listening on port 80')
		})
		db = getDb()
	}
})

//routes
app.get('/users', (req, res) => {
	let users = []

	db.collection('users')
		.find()
		.sort({"email": 1})
		.forEach(user => users.push(user))
		.then(() => {
			res.status(200).json(users)
		})
		.catch(() => {
			res.status(500).json({error: 'Could not find user'})
		})
})

// route to get user data
app.get('/users/me', authenticateJWT, (req, res) => {
	console.log("hello", req.user)
	db.collection('users')
		.findOne({"login.email": req.user.username})
		.then(result => {
			if (!result) {
				res.status(404).json({error: 'User not found'})
			} else {
				res.status(200).json(result)
			}
		})
		.catch(error => {
			res.status(500).json({error: 'Something went wrong!'})
		})
});

// to use this route, you need to pass the email as a parameter
// example: /users/aldoub@gmail
app.get('/users/:email', (req, res) => {
	db.collection('users')
		.findOne({"login.email": req.params.email})
		.then(result => {
			// if the user is not found, result will be null
			// so we need to check for that
			if (!result) {
				res.status(404).json({error: 'User not found'})
			} else {
				res.status(200).json(result)
			}
		})
		.catch(error => {
			res.status(500).json({error: 'Something went wrong!'})
		})
})

app.post('/users/login', async (req, res) => {
	try {
	  const creds = req.body;
	  const username = creds.username;
	  const password = creds.password;
  
	  // Check if the user exists
	  const result = await db.collection('users').findOne({ 'login.email': username });
  
	  if (result) {
		// Check if the password matches
		const passwordMatches = await bcrypt.compare(password, result.login.password);
  
		if (passwordMatches) {
		  // Login successful
		  // generate token
		  const accessToken = jwt.sign({ username: username }, secret_key, { expiresIn: expiresIn })
		  res.status(200).json({ success: true, message: 'Login successful', username, accessToken: accessToken });
		} else {
		  // Incorrect password
		  res.status(401).json({ success: false, error: 'Incorrect password' });
		}
	  } else {
		// User not found
		res.status(404).json({ success: false, error: 'User not found' });
	  }
	} catch (error) {
	  // Internal server error
	  console.error(error);
	  res.status(500).json({ success: false, error: 'Something went wrong!' });
	}
  });


app.post('/users/signup', async (req, res) => {
	try {
	  const creds = req.body;
	  const username = creds.username;
	  const password = creds.password.toString();
  
	  // Check if user already exists
	  const existingUser = await db.collection('users').findOne({ 'login.email': username });
  
	  if (!existingUser) {
		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10);
  
		// Create user object
		const newUser = {
		  login: {
			email: username,
			signedUp: true,
			password: hashedPassword
		  }
		};
  
		// Insert user into the database
		const result = await db.collection('users').insertOne(newUser);
  
		if (result.insertedId !== null) {
		  // User created successfully
		  res.status(201).json({ success: true, message: 'User created successfully', username });
		} else {
		  // User creation failed
		  res.status(500).json({ success: false, error: 'User could not be created' });
		}
	  } else {
		// User already exists
		res.status(400).json({ success: false, error: 'User already exists' });
	  }
	} catch (error) {
	  // Internal server error
	  res.status(500).json({ success: false, error: 'Something went wrong!' });
	}
  });


app.post('/users', (req, res) => {
	const newUser = req.body
	db.collection('users')
		.insertOne(newUser)
		.then(result => {
			res.status(201).json(result)
		})
		.catch(error => {
			res.status(500).json({error: 'Could not add user'})
		})
})

app.delete('/users/:email', (req, res) => {
	db.collection('users')
		.deleteOne({"login.email": req.params.email})
		.then(result => {
			res.status(200).json(result)
		})
		.catch(error => {
			res.status(500).json({error: 'Could not delete user'})
		})
})

app.patch('/users/:email', (req, res) => {
	const updates = req.body

	db.collection('users')
		.updateOne({"login.email": req.params.email}, {$set: updates})
		.then(result => {
			res.status(200).json(result)
		})
		.catch(error => {
			res.status(500).json({error: 'Could not update user'})
		})
})

app.put('/users/reset', (req, res) => {
	const creds = req.body
	let username = creds.username
	let password = creds.password
	db.collection('users')
		.findOneAndUpdate(
			{ "login.email": username },
			{ $set: { "login.password": password } }, 
			{ returnOriginal: false }
		)
		.then(result => {
			res.status(200).json({ message: 'Password updated successfully' });
		})
		.catch(error => {
			console.log(error)
			res.status(500).json({error: 'Error updating password'})
		})
})

app.get('/countries', (req, res) => {
    let countries = []

    db.collection('countries')
        .find()
        .sort({"name": 1})
        .forEach(country => countries.push(country))
        .then(() => {
            res.status(200).json(countries)
        })
        .catch(() => {
            res.status(500).json({error: 'Could not find countries'})
        })
})

app.get('/cities/:country', async (req, res) => {
	try {
	  const country = req.params.country;
	  const document = await db.collection('cities').findOne({ country: country });
  
	  if (!document) {
		res.status(404).json({ error: 'Country not found' });
	  } else {
		res.status(200).json(document);
	  }
	} catch (error) {
	  console.error('Error:', error);
	  res.status(500).json({ error: 'Something went wrong!' });
	}
  });

  app.get('/theatres/:city', async (req, res) => {
	try {
	  const city = req.params.city;
	  const document = await db.collection('theatres').findOne({ city: city });
  
	  if (!document) {
		res.status(404).json({ error: 'City not found' });
	  } else {
		res.status(200).json(document);
	  }
	} catch (error) {
	  console.error('Error:', error);
	  res.status(500).json({ error: 'Something went wrong!' });
	}
  });

  app.get('/movies', async (req, res) => {
	try {
	  const documents = await db.collection('movies').find().toArray();
  
	  if (!documents || documents.length === 0) {
		res.status(404).json({ error: 'No movies found' });
	  } else {
		res.status(200).json(documents);
	  }
	} catch (error) {
	  console.error('Error:', error);
	  res.status(500).json({ error: 'Something went wrong!' });
	}
  });
  
  
  
  
  
