/** The Colonnade (rooms.md, `pg-c-1x1-ranged-02`): the `room` block copied verbatim. */
import { expandRoom } from '../notation';

export default expandRoom(`
id        pg-c-1x1-ranged-02
name      The Colonnade
kind      combat
shape     1x1
focus     ranged
bands     2 3
weight    1
grid
 0 1111..::....1111 x..c........c..x
 1 1111<.::...>1111 ................
 2 1111<.::...>1111 ..x..........x..
 3 1111........1111 ...o........o...
 4 ................ ...............o
 5 .....##..##..... .......+!.......
 6 :::..##..##..::: ................
 7 :::....##....::: ................
 8 .......##....... ................
 9 .....##..##..... o...............
10 .....##..##..... .......RR.......
11 ................ .......RR.!.....
12 1111........1111 ...o........o...
13 1111<.::...>1111 ..x..........x..
14 1111<.::...>1111 ................
15 1111..::....1111 x..c........c..x
obstacles
  high   0,0 4,3 north-west balcony (+1 m) and stair: a Chorister perch
  high   11,0 15,3 north-east balcony
  high   0,12 4,15 south-west balcony
  high   11,12 15,15 south-east balcony
  jump   0,0 3,3 players hop up any 1 m balcony edge; the Blessed queue for its one stair
  jump   12,12 15,15 the same for the opposite balcony
  cover  5,5 6,6 colonnade pillar (4 m) between a balcony and the hall
  cover  9,5 10,6 colonnade pillar (4 m) between a balcony and the hall
  cover  5,9 6,10 colonnade pillar (4 m) between a balcony and the hall
  cover  9,9 10,10 colonnade pillar (4 m) between a balcony and the hall
  cover  7,7 8,8 central pier: blocks the diagonals between balconies; also a kite post
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.75 chorister 0.25
  3 0.40 blessed 0.7 chorister 0.3
`);
