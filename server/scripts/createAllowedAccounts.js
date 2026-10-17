
require("dotenv").config();

const mongoose = require("mongoose");
const readline = require("readline");
const User = require("../models/User");

const EMAILS = ["jarvis@test.com", "zap@test.com"];

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let password = "";

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (key) => {
      if (key === "\u0003") {
        cleanup();
        process.exit(1);
      }
      if (key === "\r" || key === "\n") {
        cleanup();
        resolve(password);
      } else if (key === "\u007f" || key === "\b") {
        password = password.slice(0, -1);
      } else if (key >= " ") {
        password += key;
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  try {
    const usernameA = (await ask("Account A username: ")).trim();
    const usernameB = (await ask("Account B username: ")).trim();

    if (
      usernameA.length < 3 ||
      usernameB.length < 3 ||
      usernameA.toLowerCase() === usernameB.toLowerCase()
    ) {
      throw new Error("Enter two different usernames, minimum 3 characters.");
    }

    const passwordA = await askPassword("Account A password (hidden): ");
    const passwordB = await askPassword("Account B password (hidden): ");

    if (passwordA.length < 6 || passwordB.length < 6) {
      throw new Error("Both passwords must contain at least 6 characters.");
    }

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGO_URI, { dbName: "test" });
    console.log("Connected database:", mongoose.connection.name);

    for (const [index, email] of EMAILS.entries()) {
      const username = [usernameA, usernameB][index];
      const password = [passwordA, passwordB][index];

      const existing = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existing) {
        console.log(`${email}: account already exists; skipped.`);
        continue;
      }

      await User.create({ username, email, password });
      console.log(`${email}: account created.`);
    }
  } catch (error) {
    console.error("Setup failed:", error.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
