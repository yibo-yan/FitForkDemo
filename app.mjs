import './config.mjs';
import './db.mjs';
import express from 'express';
const app = express();
app.use(express.static('public'));


// session mamagement part
import session from 'express-session';
import mongoose from 'mongoose';
const sessionOptions = {
    secret: 'secret for signing session id', 
	saveUninitialized: false, 
	resave: false 
};
app.use(session(sessionOptions));
//enable the app from retrieve data from the req
app.use(express.urlencoded({ extended : false }));



// Definition of the db schemas
const Recipe = mongoose.model('recipes');
const Users = mongoose.model('users');


app.set('view engine', 'hbs');

app.get('/', (req, res) => {
    if(req.session.username && req.session.password){
        console.log('already have the session_username');
        res.render('homepage', {session_username : req.session.username, session_password : req.session.password});
    }else{
        res.render('homePage');
    }
});
app.post('/personalPage', async (req, res) => {
    let username, password;
    username = req.body.username;
    password = req.body.password;
    try{
        //try to find the user with the same username and password
        const User = await Users.findOne({
            username: username,
            hash: password,
        })
        req.session.username = username;
        req.session.password = password;
        console.log("username : " + req.session.username + " password : " + req.session.password);
        if(!User){
            res.render('homePage', {warningTxt : "incorrect username or password"});
        }
        else{
            const desiredCal = await User.desiredCal;
            // retrieive the materials
            const materials = await User.foodMaterials;
            try{
                res.render('personalPage', {username : username, userCal : desiredCal, mat1 : materials[0].name, mat2 : materials[1].name, mat3 : materials[2].name, mat4 : materials[3].name});
            }catch{
                res.render('personalPage', {username : username, userCal : desiredCal});
            }
        }
    }catch{
        res.render('homePage', {warningTxt : "unable to login"});
    }
})

app.post('/personalPage/submit', async (req, res) => {
    const materials = [req.body.material1, req.body.material2, req.body.material3, req.body.material4];
    const cal = req.body.expectedCalorie;
    console.log("Submitted materials:", materials);
    try {
        console.log("my expected cal is " + cal);
        // main function, searching the recipe collections
        let ansDish = await dishSearcher(materials, cal);
        // log out the ans
        if(ansDish == null){
            res.render('recipeShowcase', { errorMess : "It seems we've stumbled into culinary no man's land with these ingredients. Why not whip up a brand-new dish and put us on the map?"});
        }
        else{
            const dishName = ansDish.dishName;
            const calories = ansDish.calories;
            const ingredients = ansDish.ingredients;
            const skill = ansDish.descrip;
            const ingreStr = formatIngredients(ingredients);
            res.render('recipeShowcase', { dishName : dishName, ingreLst : ingreStr, cookSkill : skill});
        }
    } catch (error) {
        console.error("Error generating recipes:", error);
        res.render('recipeShowcase', { errorMess: "Error processing your request." });
    }
});
app.get('/personalPage', async (req, res) => {
    if(!req.session.username){
        res.redirect('/');
    }
    else{
        let username = req.session.username;
        let password = req.session.password;
        const User = await Users.findOne({
            username: req.session.username,
            hash: req.session.password,
        });
        console.log("username : " + req.session.username + " password : " + req.session.password);
        const desiredCal = await User.desiredCal;
            // retrieive the materials
        const materials = await User.foodMaterials;
        try{
            res.render('personalPage', {username : username, userCal : desiredCal, mat1 : materials[0].name, mat2 : materials[1].name, mat3 : materials[2].name, mat4 : materials[3].name});
        }catch{
            res.render('personalPage', {username : username, userCal : desiredCal});
        }
    }
});
app.get('/recipe', async (req, res) => {
    let dishes = await Recipe.find({});
    res.render('recipe', {recipeInputs : dishes});
});
app.get('/recipe/add', (req, res) => {
    res.render('recipe-adder');
})
app.post('/recipe', async (req, res) => {
    try{
        let name = req.body.Name;
        let calorie = req.body.Calories;
        let ingredientLst = req.body.ingredients;
        let description = req.body.descrip;
        console.log(name, calorie, ingredientLst, description);
        // preparing the ingredient data
        try{
            const ingredientsInput = await ingredientLst.map(item => {
                const parts = item.split(' '); 
                const quantityWithUnit = parts.shift();
                const name = parts.join(' '); 
                const quantity = parseInt(quantityWithUnit, 10); 
            
                return { name, quantity };
            });
            console.log(ingredientsInput);
            // create the new Recipe
            const newRecipe = new Recipe({
                dishName : name,
                ingredients : ingredientsInput,
                calories : calorie,
                descrip : description
            });
            newRecipe.save().then(doc => res.redirect('/recipe'));
        }
        catch{
            res.redirect('/recipe');
        }
    }
    catch{
        res.redirect('/recipe');
    }
})

app.get('/register', (req, res) => {
    res.render('register');
});
app.post('/', (req, res) => {
    try{
        console.log(req.body.userName, req.body.pass, req.body.cal);
        const newUser = new Users({
            username : req.body.userName,
            hash : req.body.pass,
            foodMaterials: [
                { name: 'Chicken', quantity: 150 },
                { name: 'Peanut', quantity: 100 },
                { name: 'Honey', quantity: 200 },
                { name: 'Chili', quantity: 250 }
            ],
            desiredCal : req.body.cal,
        })
        newUser.save();
        res.render('homePage');
    }catch{
        res.render('homePage', {warningTxt : "Unable to register"});
    }
})

function lstCompare(userMaterial, recipeMaterial){
    let counter = 0;
    recipeMaterial.forEach(item => {
        userMaterial.forEach(userMat => {
            if(item.name == userMat){
                counter++;
            }
        })
    });
    console.log(`Matching ingredients count: ${counter}, Required: ${recipeMaterial.length}`);
    if(counter >= recipeMaterial.length){
        console.log("the Dish is found");
        return true;
    }
    else{return false;}
}
async function dishSearcher(userMaterial, cal) {
    try{
        const dishes = await Recipe.find({});
        console.log('the dishes are loaded');
        for (const dish of dishes) {
            let fitDish = lstCompare(userMaterial, dish.ingredients);
            if (fitDish && cal >= dish.calories) {
                console.log('Dish is here: ' + dish.dishName); // Assuming dishName is a property you want to log
                return dish;
            }
        }
    }
    catch{
        return null;
    }
}
function formatIngredients(ingredients) {
    const formattedIngredients = ingredients.map(ingredient => {
        const nameWithSpaces = ingredient.name.replace(/([a-z])([A-Z])/g, '$1 $2');
        return `${ingredient.quantity}g ${nameWithSpaces}`;
    });
    return `The ingredients are ${formattedIngredients.slice(0, -1).join(', ')} and ${formattedIngredients[formattedIngredients.length - 1]}.`;
}
export default app;
