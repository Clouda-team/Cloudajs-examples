/**
 * Copyright (c) 2013 Oliver Luan (luanyanqiang01@baidu.com) Gan Xun (ganxun@baidu.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

sumeru.validation.addrule("birdName" , {
    "runat":"both",
    "func":function(name){
        var birdNameArray = ["Albatross","Auklet","Bittern","Blackbird","Bluebird",
            "Booby","Bunting","Canary","Chickadee","Cormorant","Cowbird","Crow","Chicken",
            "Dove","Dowitcher","Duck","Eagle","Egret","Falcon","Finch","Flycatcher",
            "Gallinule","Gnatcatcher","Godwit","Goldeneye","Goldfinch","Goose","Grackle","Grebe","Grosbeak",
            "Gull","Hawk","Heron","Hen","Hummingbird","Ibis","Jaeger","Jay","Junco","Kingbird","Kinglet","Kite","Loon",
            "Magpie","Meadowlark","Merganser","Murrelet","Nuthatch","Oriole","Ostrich","Owl","Parrot","Peacock","Pelican","Petrel","Penguin","Phalarope",
            "Phoebe","Pigeon","Pipit","Plover","Puffin","Quail","Rail","Redstart","Robin","Sandpiper","Sapsucker","Scaup","Scoter",
            "Shearwater","Seagull","Shrike","Skua","Sparrow","Storm-Petrel","Swallow","Swan","Swift","Tanager","Teal","Tern","Thrasher","Thrush",
            "Titmouse","Towhee","Turkey","Turnstone","Vireo","Vulture","Warbler","Wigeon","Woodpecker","Wren","Yellowlegs"];

        return -1 != birdNameArray.indexOf(name);
    }
});