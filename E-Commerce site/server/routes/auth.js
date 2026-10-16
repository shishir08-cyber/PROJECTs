const express = require("express")
const router = express.Router()
const pool = require("../models/db")

router.post("/login", async (req, res) => {

const { email, password } = req.body

const result = await pool.query(
"SELECT * FROM users WHERE email=$1 AND password=$2",
[email, password]
)

if(result.rows.length > 0){
res.json({ success: true, user: result.rows[0] })
}else{
res.json({ success: false })
}

})

module.exports = router