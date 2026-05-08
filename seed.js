const sqlite3=require("sqlite3").verbose();
const db=new sqlite3.Database("database.db");

db.serialize(()=>{

// TABLES
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

// DATA
const langs=["python","java","c","cpp","javascript","sql","mongo"];

const easy=[
["Sum","Print sum of two numbers","2 3","5"],
["Max","Print largest number","3 9","9"],
["Square","Print square","5","25"]
];

const medium=[
["Prime","Check prime","7","YES"],
["Palindrome","Check palindrome","121","YES"],
["Factorial","Find factorial","5","120"]
];

const hard=[
["Fibonacci","Nth fibonacci","6","8"],
["GCD","Find GCD","12 18","6"],
["Power","a^b","2 5","32"],
["Reverse","Reverse number","123","321"]
];

let difficulties=[
 {name:"Easy",list:easy,score:10},
 {name:"Medium",list:medium,score:20},
 {name:"Hard",list:hard,score:30}
];

// INSERT
langs.forEach(lang=>{
 difficulties.forEach(level=>{
  level.list.forEach(p=>{

   db.run(
    `INSERT INTO problems(title,description,difficulty,language,time_limit,score)
     VALUES(?,?,?,?,?,?)`,
    [p[0],p[1],level.name,lang,2,level.score],
    function(){

     db.run(
      `INSERT INTO testcases(problem_id,input,output,hidden)
       VALUES(?,?,?,0)`,
      [this.lastID,p[2],p[3]]
     );

    }
   );

  });
 });
});

});

setTimeout(()=>{
 console.log("All Problems Inserted Successfully");
 db.close();
},2000);
