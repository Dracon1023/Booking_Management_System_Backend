const express = require('express')
const { connectDb, getDb } = require('./db')
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { ObjectID } = require('mongodb')
const cors = require("cors")
const app = express()
app.use(express.json())
app.use(cors())
const bcrypt = require('bcrypt')
const { MongoClient } = require('mongodb')
const QRCode = require('qrcode');




// login token
const jwt = require('jsonwebtoken')

// get secret key from dev.env file
require('dotenv').config()

const secret_key = process.env.SECRET_KEY
const expiresIn = process.env.EXPIRES_IN

// middleware for jwt
const authenticateJWT = (req, res, next) => {
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
app.get('/', (req, res) => {
	res.send('Booking Service - Waiting for database requests!')
})


app.get('/users', (req, res) => {
	let users = []

	db.collection('users')
		.find()
		.sort({ "email": 1 })
		.forEach(user => users.push(user))
		.then(() => {
			res.status(200).json(users)
		})
		.catch(() => {
			res.status(500).json({ error: 'Could not find user' })
		})
})

// route to get user data
app.get('/users/me', authenticateJWT, (req, res) => {
	console.log("hello", req.user)
	db.collection('users')
		.findOne({ "login.email": req.user.username })
		.then(result => {
			if (!result) {
				res.status(404).json({ error: 'User not found' })
			} else {
				res.status(200).json(result)
			}
		})
		.catch(error => {
			res.status(500).json({ error: 'Something went wrong!' })
		})
});

// to use this route, you need to pass the email as a parameter
// example: /users/aldoub@gmail
app.get('/users/:email', (req, res) => {
	db.collection('users')
		.findOne({ "login.email": req.params.email })
		.then(result => {
			// if the user is not found, result will be null
			// so we need to check for that
			if (!result) {
				res.status(404).json({ error: 'User not found' })
			} else {
				res.status(200).json(result)
			}
		})
		.catch(error => {
			res.status(500).json({ error: 'Something went wrong!' })
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
			res.status(500).json({ error: 'Could not add user' })
		})
})

app.delete('/users/:email', (req, res) => {
	db.collection('users')
		.deleteOne({ "login.email": req.params.email })
		.then(result => {
			res.status(200).json(result)
		})
		.catch(error => {
			res.status(500).json({ error: 'Could not delete user' })
		})
})

app.patch('/users/:email', (req, res) => {
	const updates = req.body

	db.collection('users')
		.updateOne({ "login.email": req.params.email }, { $set: updates })
		.then(result => {
			res.status(200).json(result)
		})
		.catch(error => {
			res.status(500).json({ error: 'Could not update user' })
		})
})

app.put('/users/reset', async (req, res) => {
	const creds = req.body
	let username = creds.username;
	//I have changed this because the password was not hashed.
	const password = creds.password.toString();
	const hashedPassword = await bcrypt.hash(password, 10);
	db.collection('users')
		.findOneAndUpdate(
			{ "login.email": username },
			{ $set: { "login.password": hashedPassword } },
			{ returnOriginal: false }
		)
		.then(result => {
			res.status(200).json({ message: 'Password updated successfully' });
		})
		.catch(error => {
			console.log(error)
			res.status(500).json({ error: 'Error updating password' })
		})
})

app.post('/users/me/update', authenticateJWT, async (req, res) => {
	try {
		const { basicInfo, paymentDetails, interests, favoriteGenre, profileImage, rewardPoints, promotionalOffers, membershipStatus } = req.body;

		// Extract the email from the authenticated user's token
		const userEmail = req.user.username;
		console.log(rewardPoints);

		// Update user document in the database based on the extracted email
		const result = await db.collection('users').updateOne(
			{ "login.email": userEmail }, // Match user by email extracted from the token
			{
				$set: {
					"basicInfo.firstName": basicInfo.firstName,
					"basicInfo.lastName": basicInfo.lastName,
					"basicInfo.mobileNumber": basicInfo.mobileNumber,
					"basicInfo.city": basicInfo.city,
					"basicInfo.state": basicInfo.state,
					"basicInfo.country": basicInfo.country,
					"basicInfo.dob": basicInfo.dob,
					"basicInfo.email": userEmail,
					profileImage,
					paymentDetails,
					interests,
					favoriteGenre,
					promotionalOffers,
					rewardPoints,
					membershipStatus,
				}
			}
		);

		if (result.modifiedCount === 1) {
			console.log("Update was successful!");
			// Document updated successfully
			res.status(200).json({ success: true, message: 'User information updated successfully' });
		} else {
			console.log("User not found! in update");
			// No document was modified, likely due to user not found
			res.status(404).json({ success: false, error: 'User not found or no changes applied' });
		}
	} catch (error) {
		// Internal server error
		console.error(error);
		res.status(500).json({ success: false, error: 'Something went wrong!' });
	}
});


app.get('/countries', (req, res) => {
	let countries = []

	db.collection('countries')
		.find()
		.sort({ "name": 1 })
		.forEach(country => countries.push(country))
		.then(() => {
			res.status(200).json(countries)
		})
		.catch(() => {
			res.status(500).json({ error: 'Could not find countries' })
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

app.get('/foodItems', async (req, res) => {
	try {
		const documents = await db.collection('foodItems').find().toArray();

		if (!documents || documents.length === 0) {
			res.status(404).json({ error: 'No food items found' });
		} else {
			res.status(200).json(documents);
			
		}
	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.get('/bookingInfo', async (req, res) => {
	try {
		const documents = await db.collection('bookingInfo').find().toArray();

		if (!documents || documents.length === 0) {
			res.status(404).json({ error: 'No booking info found' });
		} else {
			res.status(200).json(documents);
		}
	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.get('/specificBookingInfo', async (req, res) => {
	try {
	  // Extract title, time, and date from the query parameters
	  const { title, time, date,theatre } = req.query;
  
	  // Decode the URL-encoded parameters
	  const decodedTitle = decodeURIComponent(title);
	  const decodedTime = decodeURIComponent(time);
	  var decodedTheatre = decodeURIComponent(theatre);
	  var decodedDate = decodeURIComponent(date);
	  decodedDate = decodedDate.trim();
	  decodedTheatre = decodedTheatre.trim();
  
	  // Construct the query to find the specific booking information
	  const query = {
		movie: decodedTitle,
		time: decodedTime,
		date: decodedDate,
		theatre:decodedTheatre
	  };

  
	  // Fetch the documents from the database that match the query
	  const documents = await db.collection('bookingInfo').find(query).toArray();
  
	  if (!documents || documents.length === 0) {
		res.status(404).json({ error: 'No booking info found for the specified movie, time, and date' });
	  } else {
		// Respond with the fetched documents
		res.status(200).json(documents);
	  }
	} catch (error) {
	  console.error('Error:', error);
	  res.status(500).json({ error: 'Something went wrong with the database operation' });
	}
  });
  
  

// Adds payment details to the user's database entry
app.post('/users/paymentDetails/addDetails', async (req, res) => {
	try {
		const details = req.body.details;
		const username = req.body.username;
		db.collection('users').updateOne(
			{}
		)

	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

// Removes a specific payment details from a user's database entry
app.delete('/users/paymentDetails/removeDetails', async (req, res) => {

});

// Update a specific payment details in a user's database entry
app.patch('/users/paymentDetails/updateDetails', async (req, res) => {

});


const CLIENT_SECRET = process.env.CLIENT_SECRET
const CLIENT_ID = process.env.CLIENT_ID
const REDIRECT_URI = 'https://developers.google.com/oauthplayground'
const REFRESH_TOKEN = process.env.REFRESH_TOKEN

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })

const sendMail = async (bookingDetails, userEmail, firstname) => {
	try {
		const accessToken = await oAuth2Client.getAccessToken()
		const transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				type: 'OAuth2',
				user: 'moviemates2024@gmail.com',
				clientId: CLIENT_ID,
				clientSecret: CLIENT_SECRET,
				refreshToken: REFRESH_TOKEN,
				accessToken: accessToken
			}
		})

		const bookingDetailsString = JSON.stringify(bookingDetails);

		// Generate the QR code
		QRCode.toFile('./qrcode.png', bookingDetailsString, (err) => {
			if (err) throw err;
			console.log('QR code image created: ./qrcode.png');
		});
		const mailOptions = {
			from: 'Movie Mates 🎬 <moviemates2024@gmail.com>',
			to: userEmail,
			subject: 'Your Movie Mates Booking Confirmation',
			text: `The Movie Mates Team`,
			html: `<h1>Hello ${firstname},</h1>
			
			<p>Thank you for booking with Movie Mates!</p>
			
			<p>Here are your booking details:</p>
			
			<ul>
			<li>Movie: ${bookingDetails.movie}</li>
			<li>Time: ${bookingDetails.time}</li>
			<li>Date: ${bookingDetails.date}</li>
			<li>Seat No.: ${bookingDetails.seats}</li>
			<li>Food Items: ${bookingDetails.foodItems}</li>
			<li>Total Cost: ${bookingDetails.totalCost}</li>
			</ul>
			
			<p>Please find attached your QR code for entry.</p>
			<img src="cid:qrcode" alt="Your QR Code"/>
			
			<p>Enjoy your movie!</p>
			
			<p>Best,<br/>
			The Movie Mates Team</p>`,
			attachments: [{
			  filename: 'qrcode.png',
			  path: './qrcode.png', 
			  cid: 'qrcode' 
			}]
		  };
		  
		const result = await transporter.sendMail(mailOptions)
		return result
	} catch (error) {
		return error
	}
}
app.post('/send-email', async (req, res) => {
	const { bookingDetails, userEmail,firstname } = req.body;

	try {
		const result = await sendMail(bookingDetails, userEmail, firstname);
		res.status(200).json({ message: 'Email sent successfully', result });
	} catch (error) {
		res.status(500).json({ message: 'Failed to send email', error });
	}
});

app.post('/paymentInfo', async (req, res) => {
	try {
	  // Extract data from req.body
	  const paymentDetails = req.body;
  
	  // Insert the paymentDetails into the paymentInfo collection
	  const result = await db.collection('paymentInfo').insertOne(paymentDetails);
  
	  res.status(200).json({ message: 'Payment details added successfully', result });
	} catch (error) {
	  console.error('Error:', error);
	  res.status(500).json({ error: 'Something went wrong!' });
	}
  });


  app.post('/bookingInfo', async (req, res) => {
	try {
	  // Extract data from req.body
	  const bookingDetails = req.body;
  
	  // Insert the paymentDetails into the paymentInfo collection
	  const result = await db.collection('bookingInfo').insertOne(bookingDetails);
  
	  res.status(200).json({ message: 'Booking details added successfully', result });
	} catch (error) {
	  console.error('Error:', error);
	  res.status(500).json({ error: 'Something went wrong!' });
	}
  });
  







