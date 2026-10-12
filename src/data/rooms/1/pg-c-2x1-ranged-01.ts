/** The Cloister of Hymns (rooms.md, `pg-c-2x1-ranged-01`): the `room` block copied verbatim. */
import { expandRoom } from '../notation';

export default expandRoom(`
id        pg-c-2x1-ranged-01
name      The Cloister of Hymns
kind      combat
shape     2x1
focus     ranged
bands     2 3
weight    1
grid
 0 22222.::................::...22222 x..........x....x....x...........x
 1 22222.::................::...22222 ...x.................o........x...
 2 22222.::................::...22222 .................!................
 3 22222........................22222 .o..............................o.
 4 22222.....#...#....#...#.....22222 ..................................
 5 ...^^........................^^... ............c........c............
 6 :::^^........................^^::: ......!...........................
 7 :::............................::: ................RR................
 8 .................................. ........o.......RR................
 9 22222........................22222 .................+.........!......
10 22222<<....................>>22222 ............c........c............
11 22222<<...#...#....#...#...>>22222 .o..............................o.
12 22222........................22222 ..................................
13 22222.::................::...22222 ...x..........................x...
14 22222.::................::...22222 ............o.....................
15 22222.::................::...22222 x..........x.....x...x...........x
obstacles
  high   0,0 4,6 north-west gallery (+2 m) and stair
  high   0,9 6,15 south-west gallery and stair
  high   29,0 33,6 north-east gallery and stair
  high   27,9 33,15 south-east gallery and stair
  cover  10,4 10,4 nave pillar: breaks the galleries' lines down the nave
  cover  10,11 10,11 nave pillar: breaks the galleries' lines down the nave
  cover  14,4 14,4 nave pillar: breaks the galleries' lines down the nave
  cover  14,11 14,11 nave pillar: breaks the galleries' lines down the nave
  cover  19,4 19,4 nave pillar: breaks the galleries' lines down the nave
  cover  19,11 19,11 nave pillar: breaks the galleries' lines down the nave
  cover  23,4 23,4 nave pillar: breaks the galleries' lines down the nave
  cover  23,11 23,11 nave pillar: breaks the galleries' lines down the nave
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 0.75 chorister 0.25
  3 0.28 blessed 0.75 chorister 0.25
  4 0.32 blessed 0.7 chorister 0.3
`);
