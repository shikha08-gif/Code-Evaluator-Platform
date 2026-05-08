const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("frontend/public"));

const PORT = 3000;

/* ================= DATABASE ================= */

const db = new sqlite3.Database("./database.db", err=>{
 if(err) console.log(err);
 else console.log("Database connected");
});

/* ================= TABLES ================= */

db.serialize(()=>{

db.run(`CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE,
 password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS problems(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT,
 description TEXT,
 difficulty TEXT,
 language TEXT,
 time_limit INTEGER,
 score INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS testcases(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 problem_id INTEGER,
 input TEXT,
 output TEXT,
 hidden INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS submissions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT,
 problem_id INTEGER,
 language TEXT,
 code TEXT,
 result TEXT,
 created DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

/* UNIQUE prevents duplicate scoring */
db.run(`CREATE TABLE IF NOT EXISTS scores(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT,
 problem_id INTEGER,
 score INTEGER,
 UNIQUE(username,problem_id)
)`);

});

/* ================= AUTO SCORE FUNCTION ================= */

function getScore(diff){
 if(diff==="Easy") return 10;
 if(diff==="Medium") return 20;
 if(diff==="Hard") return 40;
 return 10;
}

/* ================= AUTH ================= */

app.post("/register",(req,res)=>{
 const {username,password}=req.body;
 if(!username||!password) return res.send("Fill all fields");

 db.run(
  "INSERT INTO users(username,password) VALUES(?,?)",
  [username,password],
  err=>{
   if(err){
    console.log("Register failed:", err);
    return res.send("User exists");
   }
   res.send("Registered");
  }
 );
});

app.post("/login",(req,res)=>{
 const {username,password}=req.body;

 db.get(
  "SELECT * FROM users WHERE username=? AND password=?",
  [username,password],
  (err,row)=>{
   if(err){
    console.log("Login query failed:", err);
    return res.send("error");
   }
   if(row) res.send("success");
   else res.send("invalid");
  }
 );
});

/* ================= ADD PROBLEM (AUTO SCORE) ================= */

app.post("/add-problem",(req,res)=>{

 const {title,description,difficulty,language,time_limit}=req.body;

 if(!title||!description||!difficulty)
  return res.send("Missing fields");

 const score=getScore(difficulty);

 db.run(
  `INSERT INTO problems(title,description,difficulty,language,time_limit,score)
   VALUES(?,?,?,?,?,?)`,
  [title,description,difficulty,language,time_limit,score],
  err=>{
   if(err){
    console.log("Add problem failed:", err);
    return res.send("Error adding problem");
   }
   res.send("Problem added with score "+score);
  }
 );
});

/* ================= PROBLEMS ================= */

app.get("/problems",(req,res)=>{
 db.all("SELECT * FROM problems",(err,rows)=>{
  res.json(rows||[]);
 });
});

app.get("/problem/:id",(req,res)=>{

 db.get("SELECT * FROM problems WHERE id=?",[req.params.id],(err,p)=>{

  if(!p) return res.json(null);

  db.get(
   "SELECT * FROM testcases WHERE problem_id=? AND hidden=0",
   [req.params.id],
   (err,test)=>{

    p.sample_input=test?test.input:"";
    p.sample_output=test?test.output:"";

    res.json(p);
   }
  );
 });
});

/* ================= FILE PREP ================= */

function prepareFile(language, code) {
 const id = Date.now();

 if(language==="python"){
  const file=`temp_${id}.py`;
  fs.writeFileSync(file,code);
  return {file,run:["python",[file]]};
 }

 if(language==="node"){
  const file=`temp_${id}.js`;
  fs.writeFileSync(file,code);
  return {file,run:["node",[file]]};
 }

 if(language==="java"){
  const className=`Main_${id}`;
  const file=`${className}.java`;

  let classCode = code.replace(/class\s+Main/g,`class ${className}`);

  if(!/class\s+/.test(classCode)){
   classCode=`
public class ${className}{
 public static void main(String[] args){
  ${code}
 }
}`;
  }

  fs.writeFileSync(file,classCode);

  return {
   file,
   compile:["javac",[file]],
   run:["java",["-cp",".",className]]
  };
 }

 return null;
}

/* ================= CLEANUP ================= */

function cleanup(file){
 if(file && fs.existsSync(file)) fs.unlinkSync(file);
}

/* ================= PROCESS ================= */

function runProcess(cmd,args,input,cb){

 const proc=spawn(cmd,args,{env:{...process.env,JAVA_TOOL_OPTIONS:''}});
 let out="";
 let err="";

 proc.stdin.write((input||"")+"\n");
 proc.stdin.end();

 const timer=setTimeout(()=>{
  proc.kill();
  cb("Time Limit Exceeded","");
 },5000);

 proc.stdout.on("data",d=>out+=d.toString());
 proc.stderr.on("data",d=>err+=d.toString());

 proc.on("close",()=>{
  clearTimeout(timer);
  cb(err,out);
 });
}

/* ================= RUN ================= */

app.post("/run",(req,res)=>{

 const {code,language,input=""}=req.body;
 const obj=prepareFile(language,code);
 if(!obj) return res.send("Language not supported");

 const execute=()=>{
  runProcess(obj.run[0],obj.run[1],input,(err,out)=>{
   cleanup(obj.file);
   if(err) return res.send(err);
   res.send(out||"No Output");
  });
 };

 if(obj.compile){
  runProcess(obj.compile[0],obj.compile[1],"",(err)=>{
   if(err) return res.send(err);
   execute();
  });
 }
 else execute();
});

/* ================= SUBMIT ================= */

app.post("/submit",(req,res)=>{

 const {username,code,language,problemId}=req.body;

 db.all(
  "SELECT * FROM testcases WHERE problem_id=?",
  [problemId],
  (err,tests)=>{

   if(err){
    console.log("Testcase query failed:", err);
    return res.send("Error loading testcases");
   }

   if(!tests.length) return res.send("No testcases");

   const obj=prepareFile(language,code);
   if(!obj) return res.send("Language not supported");

   let passed=0;
   let results=[];

   function finish(){

    cleanup(obj.file);

    const verdict = passed===tests.length
     ? "Accepted"
     : `Failed (${passed}/${tests.length})`;

    db.run(
     "INSERT INTO submissions(username,problem_id,language,code,result) VALUES(?,?,?,?,?)",
     [username,problemId,language,code,verdict],
     err=>{
      if(err) console.log("Submission insert failed:", err);
     }
    );

    if(passed===tests.length){

     db.get("SELECT score FROM problems WHERE id=?",[problemId],(err,row)=>{
      if(err){
       console.log("Score lookup failed:", err);
      }

      const score = row ? row.score : 0;

      db.run(
       "INSERT OR IGNORE INTO scores(username,problem_id,score) VALUES(?,?,?)",
       [username,problemId,score],
       err=>{
        if(err) console.log("Score insert failed:", err);
       }
      );

      res.send(verdict+"\nScore: "+score+"\n"+results.join("\n"));
     });

    } else {
     res.send(verdict+"\nScore: 0\n"+results.join("\n"));
    }
   }

   function runTest(i){

    if(i>=tests.length) return finish();

    runProcess(obj.run[0],obj.run[1],tests[i].input,(err,out)=>{

     if(err)
      results.push(`Test ${i+1}: Error`);
     else if(out.trim()==tests[i].output.trim()){
      passed++;
      results.push(`Test ${i+1}: Passed`);
     }
     else
      results.push(`Test ${i+1}: Failed`);

     runTest(i+1);
    });
   }

   if(obj.compile){
    runProcess(obj.compile[0],obj.compile[1],"",(err)=>{
     if(err) return res.send(err);
     runTest(0);
    });
   }
   else runTest(0);

 });
});

/* ================= HISTORY ================= */

app.get("/history/:user",(req,res)=>{

 const user = req.params.user;

 db.all(`
   SELECT 
     s.id,
     s.problem_id,
     s.language,
     s.code,
     s.result,
     s.created,
     p.title,
     p.score
   FROM submissions s
   LEFT JOIN problems p
   ON s.problem_id = p.id
   WHERE s.username=?
   ORDER BY s.id DESC
 `,
 [user],
 (err,rows)=>{
   if(err) return res.json([]);
   res.json(rows);
 });

});

/* ================= LEADERBOARD ================= */

app.get("/leaderboard",(req,res)=>{
 db.all(`
 SELECT username,SUM(score) as total
 FROM scores
 GROUP BY username
 ORDER BY total DESC
 `,(err,rows)=>{
  res.json(rows||[]);
 });
});

/* ================= START ================= */

app.listen(PORT,()=>{
 console.log("Server running → http://localhost:"+PORT);
});