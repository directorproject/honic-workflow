const sample = `45
9 REFERENCES
[1] I. report, "Accident reporting system," Incident report, 19 January 2022. [Online]. Available:
incidentreport.net. [Accessed 12 January 2023].
[2] P. A. M. D. A. H. B. D. N. K. S. Parameswaran, "Automatic Vehicle Accident Detection and
Messageing System," International Jounal of Engineering research & technology (IJERT),
vol. 4, no. 11, pp. 1-3, 2016.
10 APPENDICES
`;

const heading =
  /(?:^|\n)\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES|REFERENCE)\s*(?:\n|:)/gi;
let lastEnd = -1;
let match;
while ((match = heading.exec(sample))) {
  console.log("match", JSON.stringify(match[0]), "at", match.index);
  lastEnd = match.index + match[0].length;
}
console.log("lastEnd", lastEnd);
if (lastEnd >= 0) {
  let body = sample.slice(lastEnd);
  const stop = body.search(/\n\s*(?:APPENDIX|APPENDICES|ANNEX|GLOSSARY)\b/i);
  console.log("stop", stop);
  if (stop > 60) body = body.slice(0, stop);
  console.log("body", body);
  const chunks = [];
  for (const part of body.split(/(?=\[\d+\])/)) {
    const t = part.replace(/\s+/g, " ").replace(/^\[\d+\]\s*/, "").trim();
    console.log("chunk len", t.length, t.slice(0, 60));
    if (t.length >= 24) chunks.push(t);
  }
  console.log("chunks", chunks.length);
}
