// ─── Munch Bunch: palette + pixel pictures ───────────────────────────────────
//
// Each picture is a grid of letters. A letter from PALETTE is a cube of that
// color; "." is empty. Levels are ordered roughly easy → hard (fewer colors and
// smaller pictures first). Adding a picture = one entry here.

export const PALETTE = {
  R: "#ff4d5e", // red
  O: "#ff9a3c", // orange
  Y: "#ffd43b", // yellow
  G: "#3ccf6e", // green
  B: "#3d8bff", // blue
  P: "#a463f2", // purple
  K: "#ff7eb6", // pink
  W: "#f5f2ea", // white
  C: "#ffe0a8", // cream
  N: "#a8653a", // brown
  D: "#655c8c", // dark (lifted so it reads on the dark board)
  L: "#7fd8ff", // light blue
  T: "#22c3b5", // teal
} as const;

export type ColorKey = keyof typeof PALETTE;

export function isColorKey(ch: string): ch is ColorKey {
  return Object.prototype.hasOwnProperty.call(PALETTE, ch);
}

export interface Picture {
  name: string;
  /** Glow color behind the board for this picture. */
  glow: string;
  art: string[];
}

export const PICTURES: Picture[] = [
 {name:'Sweet Heart', glow:'#ff7eb6', art:[
  '..RRR...RRR..','.RKKKR.RKKKR.','RKWWKKRKKKKKR','RKWKKKKKKKKKR','RKKKKKKKKKKKR','.RKKKKKKKKKR.',
  '..RKKKKKKKR..','...RKKKKKR...','....RKKKR....','.....RKR.....','......R......']},
 {name:'Strawberry', glow:'#ff4d5e', art:[
  '....GG....','..GGGGGG..','.RRGGGGRR.','RRYRRRRYRR','RRRRRYRRRR','RYRRRRRRYR','.RRRYRRRR.','.RRRRRRYR.','..RYRRRR..','...RRRR...']},
 {name:'Lady Bug', glow:'#ff4d5e', art:[
  '....D...D....','.....D.D.....','....DDDDD....','...DWDDDWD...','..RRRRDRRRR..','.RRDDRDRDDRR.','.RRDDRDRDDRR.',
  'RRRRRRDRRRRRR','RDDRRRDRRRDDR','RDDRRRDRRRDDR','.RRRRRDRRRRR.','..RRRRDRRRR..','....RRDRR....']},
 {name:'Lucky Mushroom', glow:'#ff4d5e', art:[
  '....RRRR....','..RRWWRRRR..','.RRWWWWRRRR.','.RRRWWRRWWR.','RRRRRRRWWWWR','RWWRRRRRWWRR','RWWWRRRRRRRR',
  '.RRRRRRRRRR.','...CCCCCC...','...CDCCDCC..','...CCCKCCC..','....CCCC....']},
 {name:'Watermelon', glow:'#3ccf6e', art:[
  'GGGGGGGGGGGGGG','.WWWWWWWWWWWW.','.RRRRRRRRRRRR.','..RRDRRRRDRR..','..RRRRRDRRRR..','...RDRRRRRR...',
  '....RRRDRR....','.....RRRR.....','......RR......']},
 {name:'Bunny', glow:'#ff7eb6', art:[
  '..WW....WW..','..WKW..WKW..','..WKW..WKW..','..WKW..WKW..','..WWWWWWWW..','.WWWWWWWWWW.','.WWDWWWWDWW.',
  '.WKWWWWWWKW.','.WWWWKKWWWW.','..WWWDDWWW..','...WWWWWW...','..WWWWWWWW..','.WWWWWWWWWW.','.WWW.WW.WWW.']},
 {name:'Ice Cream', glow:'#ff7eb6', art:[
  '.....RR.....','.....R......','...KKKKKK...','..KKBKKKYK..','.KKKKKKBKKK.','.KYKKKKKKKK.','.KKKKBKKKYK.',
  '..KKKKKKKK..','..NNCNNCNN..','...NCNNCN...','...CNNCNN...','....NNCN....','....NCNN....','.....NN.....']},
 {name:'Happy Frog', glow:'#3ccf6e', art:[
  '..GGG....GGG..','.GWWWG..GWWWG.','.GWDWGGGGWDWG.','GGGGGGGGGGGGGG','GGGGGGGGGGGGGG','GKKGGGGGGGGKKG',
  'GGDGGGGGGGGDGG','GGGDDDDDDDDGGG','.GGGGGGGGGGGG.','..GGGGGGGGGG..','.GG.GGGGGG.GG.','GGG........GGG']},
 {name:'Sunny Day', glow:'#ffd43b', art:[
  '......O......','.O....O....O.','..O.YYYYY.O..','...YYYYYYY...','..YYDYYYDYY..','OOYYDYYYDYYOO','..YKYYYYYKY..',
  '..YYDYYYDYY..','..YYYDDDYYY..','...YYYYYYY...','..O.YYYYY.O..','.O....O....O.','......O......']},
 {name:'Kitty Cat', glow:'#ff9a3c', art:[
  '.OO........OO.','.OKO......OKO.','.OKKOOOOOOKKO.','.OOOOOOOOOOOO.','OOOOOOOOOOOOOO','OOODDOOOODDOOO',
  'OOODWOOOODWOOO','OOOOOOOOOOOOOO','OOOOOWWWWOOOOO','OOOOWWKKWWOOOO','.OOOWWWWWWOOO.','..OOOOOOOOOO..','....OOOOOO....']},
 {name:'Cactus Pal', glow:'#3ccf6e', art:[
  '.....K.....','....KYK....','.....K.....','....GGG....','.G..GGG....','.G..GGG..G.','.GG.GGG..G.',
  '..GGGGG.GG.','....GGGGG..','....GGG....','....GGG....','.OOOOOOOOO.','..ONONONO..','..OOOOOOO..']},
 {name:'Penguin', glow:'#7fd8ff', art:[
  '....DDDD....','...DDDDDD...','..DDDDDDDD..','..DWWDDWWD..','..DWDWWDWD..','..DWWOOWWD..','.DDKWOOWKDD.',
  'DDDWWWWWWDDD','DD.WWWWWW.DD','D..WWWWWW..D','..DWWWWWWD..','..DWWWWWWD..','...DWWWWD...','..OOO..OOO..']},
 {name:'Pink Flower', glow:'#ff7eb6', art:[
  '.....KKK.....','..KK.KKK.KK..','.KKKKKKKKKKK.','.KKKKYYYKKKK.','..KKYYYYYKK..','KKKKYYOYYKKKK','..KKYYYYYKK..',
  '.KKKKYYYKKKK.','.KKKKKKKKKKK.','..KK.KGK.KK..','......G......','.GGG..G..GGG.','..GGG.G.GGG..','....GGGGG....','......G......']},
 {name:'Busy Bee', glow:'#ffd43b', art:[
  '....LLL.LLL...','...LLLLLLLLL..','....LLL.LLL...','..YYDDYYDDYY..','.YYYDDYYDDYWW.','DYYYDDYYDDYWDY',
  '.YYYDDYYDDYYYY','..YYDDYYDDYYY.','...YDDYYDDYY..']},
 {name:'Snowman', glow:'#7fd8ff', art:[
  '....DDDD....','....DDDD....','...DDDDDD...','....WWWW....','...WDWWDW...','...WWOOWW...','...WWWWWW...',
  '..RRRRRRRR..','..WWWWRRWW..','N.WWWDWRWW.N','.NWWWWWWWWN.','.WWWWDWWWWW.','WWWWWWWWWWWW','WWWWWDWWWWWW','.WWWWWWWWWW.']},
 {name:'Rainbow Sky', glow:'#7fd8ff', art:[
  '....RRRRRRRR....','..RROOOOOOOORR..','.ROOYYYYYYYYOOR.','ROYYGGGGGGGGYYOR','ROYGGBBBBBBGGYOR','ROYGBBPPPPBBGYOR',
  'ROYGBP....PBGYOR','WWWWBP....PBWWWW','WWWWWW....WWWWWW','.WWWW......WWWW.']},
 {name:'Big Whale', glow:'#3d8bff', art:[
  '..L.L...........','...L............','..BBBB..........','.BBBBBBBB.....BB','BBDBBBBBBBB..BBB','BBBBBBBBBBBBBBB.',
  'BKBBBBBBBBBBBB..','LLLLLLLLLLLBB...','.LLLLLLLLLB.....','...LLLLL........']},
 {name:'Cupcake', glow:'#ff7eb6', art:[
  '.....RR.....','......R.....','....KKKK....','...KKYKKK...','..KKKKKBKK..','.KBKKKKKKYK.','KKKKKYKKKKKK',
  'KKKKKKKKKKKK','.LPLPLPLPLP.','.LPLPLPLPLP.','..LPLPLPLP..','..LPLPLPLP..','...LPLPLP...']},
 {name:'Goldfish', glow:'#22c3b5', art:[
  '.............L.','.....YYYY...L..','...TTTTTTT.....','..TWDTTTTTT..YY','.TTDDTTBTTTTYYY','TTTTTTBTTTTTYY.',
  '.TTTTTTBTTTTYYY','..TTTTTTTTT..YY','...TTTTTTT.....','.....YYY.......']},
 {name:'Royal Crown', glow:'#ffd43b', art:[
  '.Y....Y....Y.','YRY..YBY..YRY','YYY..YYY..YYY','YYYYYYYYYYYYY','YYYYYYYYYYYYY','YRYYBYYYBYYRY','YYYYYYPYYYYYY',
  'OOOOOOOOOOOOO','OOOOOOOOOOOOO']},
 {name:'Butterfly', glow:'#a463f2', art:[
  'PPPP.......PPPP','PKKPP.....PPKKP','PKYKPP.D.PPKYKP','PKKPPPPDPPPPKKP','.PPPPPPDPPPPPP.','..PPPPPDPPPPP..',
  '...BBBBDBBBB...','..BBLBBDBBLBB..','.BBLLBBDBBLLBB.','.BBBBB.D.BBBBB.','..BBB.....BBB..']},
 {name:'Space Rocket', glow:'#ffd43b', art:[
  '.....RR.....','....RRRR....','...RRRRRR...','...WWWWWW...','...WWLLWW...','..WWLBBLWW..','..WWLBBLWW..',
  '..WWWLLWWW..','..WWWWWWWW..','..WWWWWWWW..','.RWWWWWWWWR.','RRWWWWWWWWRR','RR.WWWWWW.RR','R...OYYO...R','....OYYO....','.....OO.....']}
];
