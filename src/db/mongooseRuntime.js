import mongoose from 'mongoose'

const production = process.env.NODE_ENV === 'production'
const autoIndex = process.env.MONGO_AUTO_INDEX === 'true' || (!production && process.env.MONGO_AUTO_INDEX !== 'false')

mongoose.set('autoIndex', autoIndex)
mongoose.set('autoCreate', autoIndex)

export { autoIndex }
