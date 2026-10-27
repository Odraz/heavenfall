import { expandRoom } from '../notation';
export default expandRoom(`
id        pg-c-1x1-hazard-flyers-01
name      The Refining Moat
kind      combat
shape     1x1
focus     hazard
secondary flyers
bands     1 2
weight    1
grid
 0 ......::........ x..x......o....x
 1 ......::........ ................
 2 ..#...::.....#.. ................
 3 ................ ....!..........x
 4 ....~~~..~~~.... ................
 5 ....~~~..~~~.... o...............
 6 :::.~~....~~.::: ......o..+......
 7 :::..........::: .......RR.......
 8 ................ .......RR.......
 9 ....~~....~~.... .........o......
10 ....~~~..~~~.... ...............o
11 ....~~~..~~~.... ................
12 ................ x.........!.....
13 ..#...::.....#.. ................
14 ......::........ ................
15 ......::........ x....o......x..x
obstacles
  lure   4,4 11,11 the moat: a 4 m fire ring round an 8 m island, a 4 m bridge on each side
  choke  7,4 8,5 north bridge: the dry way onto the island
  choke  7,10 8,11 south bridge
  lure   2,2 2,2 corner post: kite round it and the train cuts the corner over the moat
  lure   13,2 13,2 corner post
  lure   2,13 2,13 corner post
  lure   13,13 13,13 corner post
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.85 cherub 0.15
  3 0.40 blessed 0.85 cherub 0.15
`);
