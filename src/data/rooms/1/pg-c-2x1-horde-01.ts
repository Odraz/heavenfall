/** The Cloudbridge (rooms.md, `pg-c-2x1-horde-01`): the `room` block copied verbatim. */
import { expandRoom } from '../notation';

export default expandRoom(`
id        pg-c-2x1-horde-01
name      The Cloudbridge
kind      combat
shape     2x1
focus     horde
bands     1 3
weight    1
grid
 0 11111.::................::........ x..x.......x........x........x....
 1 11111.::........##......::........ .o................................
 2 11111.::........##......::........ .......................o..........
 3 11111............................. .....................c...........x
 4 ...^^............................. .....c........!.............c.....
 5 .........-----..-^-..----......... ..................................
 6 :::......-----..---..----......::: ............o.....................
 7 :::......<----..---..--->......::: ..............RR.+................
 8 .........<----..---..--->......... ..............RR..................
 9 .........-----..---..----....vv... ........o!............o..........o
10 .........-----..-v-..----....vv... .........................x........
11 ..........................>>222222 x...................!.............
12 ..........................>>222222 .............c....................
13 ......::........##......::..222222 ..........o....................x..
14 ......::........##......::..222222 ..................................
15 ......::................::..222222 x..x.......x........x...........o.
obstacles
  kite   9,5 24,10 the basin, 1 m deep: players hop out anywhere, the Blessed only by its four stairs; dive in to shed a train
  jump   9,5 24,10 the basin's 1 m edges
  choke  14,5 15,10 west bridge (4 m) across the basin: the crowd crosses here, a lamp at each mouth
  choke  19,5 20,10 east bridge (4 m)
  kite   16,1 17,2 north pier (4 x 4 m) between the bridges
  kite   16,13 17,14 south pier
  high   26,9 33,15 south-east terrace (+2 m), stairs from the north and the west: the crest's view of the basin
  high   0,0 4,4 north-west ledge (+1 m) and its stair
  jump   0,0 4,3 the ledge's 1 m edge
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 1
  3 0.28 blessed 1
  4 0.32 blessed 1
`);
