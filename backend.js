const request = require('request-promise');
const https = require('https');
const express = require('express'); 
const bodyParser = require('body-parser'); 
const path = require("path")

const app = express();
const port = 8081;  

//allows JSON to be parsed
app.use(express.urlencoded({ extended: true })); 
app.use(express.json())


// allows the running of css and Javascript on webpages 
app.use("/static", express.static('./static/')); 
app.use(express.static(__dirname + "/final")); 

//allows webpages to served 
app.engine('html', require('ejs').renderFile);

//initalise the firebase 
const admin = require("firebase-admin");
const {Storage} = require("@google-cloud/storage"); 



// to authenticate the server with firebase 
const keyFilename = require(path.resolve("saferwalk-4f5ae-07baba285c5f.json"))

const configuration = {
    credential: admin.credential.cert(keyFilename),
    apiKey: "AIzaSyDY18l2paQCNFsLUgyCwDCHzkb0jv6c1sI",
    authDomain: "saferwalk-4f5ae.firebaseapp.com",
    databaseURL: "https://saferwalk-4f5ae-default-rtdb.firebaseio.com",
    projectId: "saferwalk-4f5ae",
    storageBucket: "saferwalk-4f5ae.appspot.com",
    messagingSenderId: "428840238201",
    appId: "1:428840238201:web:469aae6ceb6160921028a8",
    measurementId: "G-JR8N6D2W7T"
}; 

//intialise the database
const app_database = admin.initializeApp(configuration);
const firestore_db = admin.firestore(app_database); 

var currentUID = ""; 

async function addData(destination_name, destination){
    
    data_to_be_Added = {
        location_name: destination_name, 
        Latitude: destination[1], 
        Longitude: destination[0], 
        Last_Accessed: admin.firestore.Timestamp.now() //save the current time
    };

    var database_reference = firestore_db.collection("User_Data").doc(currentUID)
    database_reference.get()
    .then((doc) =>{
        if (doc.exists){

            //check whether the location exists 
            database_reference.collection("Locations").where('location_name', '==', destination_name).get()
            .then((query) =>{
                if (!query.empty){

                    //update the last_accessed parameter for the data, if data exists
                    query.forEach(doc =>{
                        database_reference.collection("Locations").doc(doc.id).update({Last_Accessed: admin.firestore.Timestamp.now()})
                    }); 

                }else{
                    database_reference.collection("Locations").orderBy("Last_Accessed").get()
                    .then((snap) =>{
                        if (snap.size == 5){
                            //overwrite the oldest previous location 
                            firestore_db.doc(snap.docs[0].ref.path).set(data_to_be_Added); 
                        } else{
                            //add the user
                            database_reference.collection("Locations").add(data_to_be_Added); 
                        };
                    });

                };
            });


        } else{

            //so empty documents are kept on the system 
            database_reference.set({
                rating: "none"
            }); 

            database_reference.collection("Locations").add(data_to_be_Added); 
             
        }
    })
    .catch((error)=>{
        console.log(error); 
    }); 

};

//get the previous locations from the users
async function retrieveData(res){
    
    var database_reference = firestore_db.collection("User_Data").doc(currentUID).collection("Locations"); 
    database_reference.get()
    .then((snap) =>{
        var locations = {}
        var num = 0

        snap.forEach(doc =>{
           locations['location' + num] = doc.data(), 
           num = num + 1; 
        });

        res.json(locations);

    })
    .catch((error)=>{
        console.log(error); 
    }); 
}

async function sendCoordinates(coordinates, res){

    // configuration 
    var options = {
        method: 'POST',
		// http:flaskserverurl:port/route
		uri: 'http://35.202.77.151:5000/',
        body: coordinates, 
		json: true,
    }; 

    //send the data to the python server and then send the result back to frontend 
    var sendrequest = await request(options)
        .then(function (parsedBody) {

            //return the data
            let result;
            result = parsedBody;
            
            res.json(result); 
        })
        .catch(function (err) {
            console.log(err);
        });

}

//load the main page
app.get("/", (req, res) =>{
    res.sendFile(path.join(__dirname, '/final/index.html')); 
})


//check whether the user has been logged
app.post("/loggedin", (req, res) =>{
    var token = req.body.token; 
    var Auth = admin.auth(app_database);

    //authenticate the token 
    Auth.verifyIdToken(token)
    .then((decodedToken) => {
        res.json({webpage: true}); //tells clients to redirect the page 
    })
    .catch((error) =>{
        res.json({webpage: false}); 
    })
})

//authenticate the user
app.post("/signIn", (req, res) =>{
    var token = req.body.Token; 
    var Auth = admin.auth(app_database)

    //authenticate the token 
    Auth.verifyIdToken(token)
    .then((decodedToken) => {
        res.json({webpage: true});
    })
    .catch((error) =>{
        console.log(error);
        res.json({webpage: false}); 
    })
})

// get the user ID (For Database operations)
app.post("/currentUser", (req, res) =>{
    currentUID = req.body.uid; 
})

//load the map page
app.get("/mapPage", (req, res) =>{
    res.sendFile(path.join(__dirname, 'main.html')); 

});

//retrieve all the previous locations for a user 
app.get("/getLocations", (req, res) =>{
    retrieveData(res); 
});

//get coordinates from frontend and pass back route 
app.post("/mapPage", (req, res) =>{

    //coordinates to be sent 
    var coordinates = {
        start: req.body.start, 
        dest: req.body.dest, 
    };

    //send coordinates to the Algorithm 
    sendCoordinates(coordinates, res); 

    addData(req.body.location, coordinates.dest); //add new entry to the database 
    
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});



