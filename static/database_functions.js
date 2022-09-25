import {getAuth, signInWithEmailAndPassword, getIdToken, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.6.9/firebase-auth.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.9/firebase-app.js'; 

async function createAccount(){

    console.log("This is being called?"); 

    var email = document.getElementById("email").value;  
    var password = document.getElementById("password").value; 

    var rentered_password = document.getElementById("rentered password").value;

    //check whether the passwords match 
    if (password === rentered_password){

        //creates a new accounts 
        createUserWithEmailAndPassword(auth, email, password) 
        .then((userCredential) =>{

            just_signed_in = true; 

            var user = userCredential.user; 
            //if account has been created succesfully UID is sent to backend 
            const send = fetch("/currentUser", {
                method: "POST", 
                headers: {
                    'Content-Type': 'application/json'
                }, 
                mode: "cors", 
                body: JSON.stringify({uid: user.uid})
            })

            window.location.assign("/mapPage");
        })
        .catch((error) =>{

            var errorCode = error.code; 
            var errorMessage = error.message; 
            
            errorCode = errorCode.substr(5);

            //handle the error message
            if (errorCode === "missing-email"){
                document.getElementById("error").firstChild.data = "Please enter in an email address";
            } else if (errorCode === "internal-error"){
                document.getElementById("error").firstChild.data = "Please enter in a password";
            } else if (errorCode === "email-already-in-use"){
                document.getElementById("error").firstChild.data = "This email is already in use. Please type in another email";
            } else if (errorCode === "weak-password"){
                document.getElementById("error").firstChild.data = "Passwords need to be at least 6 characters";
            }

            document.getElementById("error").style.display = "block";

        }); 
    } else{
        //if the two passwords don't match 
        document.getElementById("error").firstChild.data = "Passwords did not match. Please try again"; 
        document.getElementById("error").style.display = "block"; 
    }
};

//signs in the  user
async function signin(){ 
    
    //retrieve email and password from the form 
    var email = document.getElementById("email").value;
    var password = document.getElementById("password").value;
    
    //sign in the user 
    signInWithEmailAndPassword(auth, email, password)
        .then ((userCredential) => {

            just_signed_in = true; 

            var user = userCredential.user; 


            var token = getIdToken(user) // return the id Token of the user, to be used in verification
            .then((idToken) =>{

                var dictionary = {
                    Token : idToken
                }

                //send the id token to backend for authentication 
                const spon = fetch("/signIn", {
                    method: "POST", 
                    headers: {
                        'Content-Type': 'application/json'
                    }, 
                    mode: "cors",
                    body: JSON.stringify(dictionary)
                })
                .then(response => response.json())
                .then(data => {
                    //checks whether the user is autenticated 
                    if (data.webpage == true){
                        
                        //send UID to backend 
                        const send = fetch("/currentUser", {
                            method: "POST", 
                            headers: {
                                'Content-Type': 'application/json'
                            }, 
                            mode: "cors", 
                            body: JSON.stringify({uid: user.uid})
                        })

                        window.location.assign("/mapPage");
                    }
                }); 
            })
        })
        .catch((error) => {
            var errorCode = error.code; 
            var errorMessage = error.message; 

            errorCode = errorCode.substr(5); 

            //handle errors
            if (errorCode === "invalid-email"){
                document.getElementById("error").firstChild.data = "Please enter in an email address";
            } else if (errorCode === "internal-error"){
                document.getElementById("error").firstChild.data = "Please enter your password";
            } else if (errorCode === "user-not-found"){
                document.getElementById("error").firstChild.data = "Email not recognised. Create an account?";
            } else if (errorCode === "wrong-password"){
                document.getElementById("error").firstChild.data = "Incorrect Password. Forgotten your password?"
            }

            document.getElementById("error").style.display = "block";
        });


};

//checks whether the user is signed in 
async function checkUserisLoggedIn(user, status){
        // temporary -- just for testing 
        current_user = user;
        logged_in = status;
    
        if (logged_in == true){
            var token = getIdToken(current_user)
            .then((idToken) =>{ 
                var dictionary = {token: idToken}; 

                //send token to backend for authentication
                const spon = fetch("/loggedin", {
                    method: "POST", 
                    headers: {
                        'Content-Type': 'application/json'
                    }, 
                    mode: "cors",
                    body: JSON.stringify(dictionary)
                })
                .then(response => response.json())
                .then(data => {

                    //checks whether user has been authenticates 
                    if (data.webpage == true){

                        //if page is mappage, don't refresh 
                        if (!document.URL.includes("/mapPage")){
                            window.location.assign("/mapPage");
                        };


                        const send = fetch("/currentUser", {
                            method: "POST", 
                            headers: {
                                'Content-Type': 'application/json'
                            }, 
                            mode: "cors", 
                            body: JSON.stringify({uid: user.uid})
                        });
                    }
                }); 

            }); 
        }; 
};

//signs the user out
async function signUserOut(){
    signOut(auth)
    .then(()=>{
        window.location.assign("/"); 
    })
    .catch((error)=>{
        console.log(error); 
    })
};


//firebase configuration
const configuration = {
    apiKey: "AIzaSyDY18l2paQCNFsLUgyCwDCHzkb0jv6c1sI",
    authDomain: "saferwalk-4f5ae.firebaseapp.com",
    databaseURL: "https://saferwalk-4f5ae-default-rtdb.firebaseio.com",
    projectId: "saferwalk-4f5ae",
    storageBucket: "saferwalk-4f5ae.appspot.com",
    messagingSenderId: "428840238201",
    appId: "1:428840238201:web:469aae6ceb6160921028a8",
    measurementId: "G-JR8N6D2W7T"
};



var app = initializeApp(configuration)
var auth = getAuth(app); 

var logged_in = false 
var current_user = null
var just_signed_in = false 

//checks to see whether the user is logged in, or when a new user has logged in 
onAuthStateChanged(auth, (user)=>{
    //checks whether a user is logged in 
    if(user){
        //if user has just signed then don't check whether they are logged in 
        if (just_signed_in == false){
            checkUserisLoggedIn(user, true);
        }else{
            just_signed_in = false;
        }
        
    }else{
        checkUserisLoggedIn(user, false);  
    }
}); 

if (document.URL.includes("login.html")){
    document.getElementById ("login").addEventListener ("click", signin, false);

} else if(document.URL.includes("mapPage")){
    document.getElementById ("signout").addEventListener ("click", signUserOut, false);

} else if(document.URL.includes("signup.html")){
    document.getElementById("submit").addEventListener("click", createAccount, false); 
};

