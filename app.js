const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

let db = null;
let app = express();
app.use(express.json());
app.use(cors());

// Connect to SQLite database
const dbPath = path.join(__dirname, "equip9.db");

const initializeDBandServer = async function () {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBandServer();
// Get all users
app.get("/users/", async (request, response) => {
  const getUsersQuery = `
    SELECT * FROM registration;`;
  const users = await db.all(getUsersQuery);
  response.send(users);
});

// Delete all users
app.delete("/users/", async (request, response) => {
  const deleteUsersQuery = `
    DELETE FROM registration;`;
  await db.run(deleteUsersQuery);
  response.send({ message: "All users deleted successfully" });
});

//Register users

app.post("/register", async (request, response) => {
  const { first_name, last_name, mobile_number, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const selectUserQuery = `
        SELECT * FROM registration
        WHERE mobile_number = '${mobile_number}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO registration (first_name, last_name, mobile_number, password)
        VALUES ('${first_name}', '${last_name}', ${mobile_number}, '${hashedPassword}');`;
    await db.run(createUserQuery);
    response.send({ message: "User created successfully" });
  } else {
    response.status(400);
    response.send({ message: "User already exists" });
  }
});

//Login users
app.post("/login", async (request, response) => {
  const { mobile_number, password } = request.body;
  const selectUserQuery = `
        SELECT * FROM registration
        WHERE mobile_number = '${mobile_number}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send({ message: "User not found" });
  } else {
    const isMatch = await bcrypt.compare(password, dbUser.password);
    if (isMatch) {
      const payload = { mobile_number: mobile_number };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken: jwtToken, mobile_number: mobile_number });
    } else {
      response.status(400);
      response.send({ message: "Invalid password" });
    }
  }
});

//Middleware function to authenticate user
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Jwt Token Not Verified");
      } else {
        request.mobile_number = payload.mobile_number;
        next();
      }
    });
  }
};
// Get User by Mobile Number
app.get("/user/:mobileNumber", authenticateToken, async (request, response) => {
  const { mobileNumber } = request.params;
  const getUserQuery = `
    SELECT * FROM registration
    WHERE mobile_number=${mobileNumber};`;
  const user = await db.get(getUserQuery);
  response.send(user);
});

///// Create a new user
app.post("/user", async (request, response) => {
  const { firstName, lastName, mobileNumber, password, createdBy, updatedBy } =
    request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const createUserQuery = `
    INSERT INTO registration (first_name, last_name, mobile_number, password, created_by, updated_by, created_at, updated_at)
    VALUES ('${firstName}', '${lastName}', ${mobileNumber}, '${hashedPassword}', '${createdBy}', '${updatedBy}', datetime('now'), datetime('now'));
  `;
  await db.run(createUserQuery);
  response.status(200).send("User created successfully");
});

////// Update user by mobile number
app.put("/user/:mobileNumber", async (request, response) => {
  const { mobileNumber } = request.params;
  const { firstName, lastName, password, updatedBy } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const updateUserQuery = `
    UPDATE registration
    SET first_name = '${firstName}', last_name = '${lastName}', password = '${hashedPassword}', updated_by = '${updatedBy}', updated_at = datetime('now')
    WHERE mobile_number = ${mobileNumber};
  `;
  await db.run(updateUserQuery);
  response.status(200).send("User updated successfully");
});

//// Delete user by mobile number
app.delete("/user/:mobileNumber", async (request, response) => {
  const { mobileNumber } = request.params;
  const deleteUserQuery = `
    DELETE FROM registration
    WHERE mobile_number = ${mobileNumber};
  `;
  await db.run(deleteUserQuery);
  response.status(200).send("User deleted successfully");
});
