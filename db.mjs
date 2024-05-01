import mongoose from 'mongoose';

mongoose.connect(process.env.DSN);

const Schema = mongoose.Schema;

const foodMaterialSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
});

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    hash: {
        type: String,
        required: true
    },
    foodMaterials: [foodMaterialSchema],
    desiredCal: {
        type: Number,
        required: true
    }
});




const dishSchema = new Schema({
    dishName: {
        type: String,
        required: true
    },
    ingredients: [foodMaterialSchema],
    calories: {
        type: Number,
        required: true
    },
    descrip: {
        type: String,
        required: true
    }
});

mongoose.model('recipes', dishSchema);
mongoose.model('users', userSchema);
