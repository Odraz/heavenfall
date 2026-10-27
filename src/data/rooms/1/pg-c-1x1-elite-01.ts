import { expandRoom } from '../notation';

/** rooms.md: preserved verbatim; full-pool adoption belongs to R2.6. */
export const lampstands = expandRoom(`
id pg-c-1x1-elite-01
name The Two Lampstands
kind combat
shape 1x1
focus elite
bands 2 3
weight 1
grid
 0 ......::........ x..x........x..x
 1 ......::........ ................
 2 ......::........ o...............
 3 ................ ............!...
 4 ................ .......o.......o
 5 ................ ......c.........
 6 :::.#......#.::: ................
 7 :::.#......#.::: .......RR.......
 8 ....#......#.... .......RR.......
 9 ....#......#.... ................
10 ................ .........c......
11 ................ o.......o....+..
12 ................ ...!............
13 ......::........ ...............o
14 ......::........ ................
15 ......::........ x..x........x..x
obstacles
 kite 4,6 4,9 the west lampstand (a 2 x 8 m pylon): loop the Dominion round it
 kite 11,6 11,9 the east lampstand: with the west one, a figure of eight
props loot 0.8 blast 0.75 blessing 0.5
waves
 1 0.25 blessed 1
 2 0.35 blessed 1 elites 1
 3 0.40 blessed 1 elites 1
`);
