/** The Open Terrace (rooms.md, `pg-c-1x1-flyers-01`): the `room` block copied verbatim. */
import { expandRoom } from '../notation';

export default expandRoom(`
id        pg-c-1x1-flyers-01
name      The Open Terrace
kind      combat
shape     1x1
focus     flyers
bands     1 2
weight    1
grid
 0 ......::........ x..x...........x
 1 ......::........ ................
 2 ......::........ .o............o.
 3 ...BBB....BBB... ...............x
 4 ...B........B... ....t....!......
 5 ...B...vv...B... ................
 6 :::...1111...::: ......+.........
 7 :::...1111...::: .......RR.......
 8 ......1111...... .....o.RR.o.....
 9 ......1111...... ................
10 ...B...^^...B... ................
11 ...B........B... .........!.t....
12 ...BBB....BBB... x...............
13 ......::........ .o............o.
14 ......::........ ................
15 ......::........ x...........x..x
obstacles
  kite   3,3 5,5 north-west hedge (1.5 m marble): the crowd walks round it, the Cherubs fly over
  kite   10,3 12,5 north-east hedge
  kite   3,10 5,12 south-west hedge
  kite   10,10 12,12 south-east hedge
  high   6,5 9,10 central dais (+1 m), stairs north and south: the best view of the sky
  jump   6,6 9,9 players hop onto the dais from any side; the Blessed take its two stairs
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.75 cherub 0.25
  3 0.40 blessed 0.7 cherub 0.3
`);
