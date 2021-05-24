const Sequelize = require("sequelize");
const { STRING } = Sequelize;
const config = {
  logging: false,
};

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define("user", {
  username: STRING,
  password: STRING,
});

// set secret key as an environment variable
const SECRET_KEY = process.env.JWT;
// enter actual secret key to terminal using "JWT=yourSecretKeyHere";

User.byToken = async (token) => {
  try {
    const userInfo = await jwt.verify(token, SECRET_KEY);
    const user = await User.findByPk(userInfo.userId);
    if (user) {
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    //   find where inputs match both username and password
    where: {
      username,
      //password
    },
  });

  const isValid = await bcrypt.compare(password, user.password);
  //console.log(isValid);
  //const notValid = await bcrypt.compare(password, user.password)

  // if user exists and isValid returns true
  if (user && isValid) {
    //   generate token
    const token = jwt.sign({ userId: user.id }, SECRET_KEY);
    // you can add {expiresIn: } with a number value as number of seconds or you can add a string "1h" for 1 hour or "1d" for 1 day
    return token;
  }
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

User.beforeCreate(async (user) => {
  const SALT_COUNT = 5;
  const hashedPassword = await bcrypt.hash(user.password, SALT_COUNT);
  //console.log("Our hashed password: ", hashedPassword);
  user.password = hashedPassword;
  return user.password;
});

const Note = conn.define("note", {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  // force: false does not drop the table
  // ids get jumbled up if force: true because the data is dropped and reseeded
  // this is a problem when we tried to refresh the page after saving a file because a different user login was associated with the api/users/:id parameter we were on
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];

  const notes = [
    { text: "Knitting a sweater" },
    { text: "Cooking a gourmet meal" },
    { text: "Playing video games" },
  ];

  const [note1, note2, note3] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  await note1.setUser(lucy);
  await note2.setUser(moe);
  await note3.setUser(larry);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      note1,
      note2,
      note3,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
