function prettyPrint(val) {
  if (val === undefined) {
    console.log("(not set)");
  } else if (typeof val === "object") {
    console.log(JSON.stringify(val, null, 2));
  } else {
    console.log(String(val));
  }
}
