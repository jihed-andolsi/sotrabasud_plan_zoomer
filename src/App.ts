require("./Assets/css/_custom.scss");
require("./Assets/css/main.css");
let $ = (window as any).$;
import * as PIXI from "pixi.js";

let tweenManager = require("pixi-tween");
import * as d3 from "d3";
import Button from "./Tools/Button";
import LoaderText from "./Tools/LoaderText";
import { isMobile } from "./Tools/DeviceDetect";


class Zoomer extends PIXI.Application {
    private Customloader = new PIXI.loaders.Loader();
    private Container = new PIXI.Container();
    private ContainerButtons = new PIXI.Container();
    private ContainerGuide = new PIXI.Container();

    private filterBackground = new PIXI.filters.ColorMatrixFilter();
    private width: number;
    private height: number;
    private widthExtent: number;
    private heightExtent: number;
    private widthExtentMaximum: number;
    private heightExtentMaximum: number;
    private selector;
    private newGraphic = [];
    private _counterGraphic: number = 0;
    private newGraphicObj = [];
    private zoomTrans = { x: 0, y: 0, k: .1 };
    private startDrawing: boolean = false;
    private lineTo: boolean = true;
    private backgroundClicked: boolean = false;
    private sprites: object = {};
    private view;
    private stage;
    private zoomHandler;
    private Graphics = [];
    private Buttons = [];
    private canvas = null;
    private context = null;
    private widthCanvas = null;
    private heightCanvas = null;
    private D3Interval = null;
    private isMobile: boolean = false;
    private PowredByText = null;
    private isZooming: boolean = false;
    private options: object = [];
    private move = true;
    private _modeSearh: boolean = false;

    constructor(width, height, options) {
        super(width, height, options);
        return this;
    }

    public init(options, callback) {
        this.options = options;
        let [width, height] = (this.options as any).size;
        if (isMobile()) {
            [width, height] = (this.options as any).sizePhone;
            if (width > height) {
                [width, height] = [height, width];
            }
        }
        (this.options as any).width = width;
        (this.options as any).height = height;
        this.Container.zIndex = 0;
        // this.Container.anchor = new PIXI.Point(0.5, 0.5);

        this.ContainerButtons.zIndex = 1;
        this.ContainerGuide.zIndex = 2;
        this.width = (this.options as any).width;
        this.height = (this.options as any).height;
        /*if (isMobile() || (this.options as any).fullSizeShow) {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }*/
        this.widthExtentMaximum = (this.options as any).widthExtentMaximum(this.width);
        this.heightExtentMaximum = (this.options as any).heightExtentMaximum(this.height);
        this.widthExtent = (this.options as any).widthExtent(this.width);
        this.heightExtent = (this.options as any).heightExtent(this.height);
        this.selector = (this.options as any).selectorId;
        this.isMobile = isMobile();
        this.appendView();
        this.setup(callback);
    }

    private appendView() {
        const $this = this;
        document.getElementById($this.selector).appendChild($this.view);
    }

    private setup(callback) {
        const $this = this;
        const s = {};
        let [width, height] = (this.options as any).size;
        if (isMobile() || (this.options as any).fullSizeShow) {
            [width, height] = [window.innerWidth, window.innerHeight];
        }
        const text = new LoaderText(width, height);

        $this.stage.addChild(text);

        $this.stage.addChild($this.Container);

        (this.options as any).sprites.forEach((e) => {
            $this.Customloader.add(e.name, e.url);
        });

        $this.Customloader.load((loader, resources) => {
            Object.keys(resources).map((e) => {
                this.sprites[e] = new PIXI.Sprite(resources[e].texture);
            });
        });
        ($this as any).Customloader.onProgress.add((e) => {
            let prog = parseInt(e.progress);
            (text as any).text = `Loading ${prog}%`;
        }); // called once per loaded/errored file
        // $this.Customloader.onError.add(() => { }); // called once per errored file
        // $this.Customloader.onLoad.add(() => { }); // called once per loaded file
        $this.Customloader.onComplete.add((e) => {
            $this.stage.removeChild(text);
            $this.addBackground();
            $this.addGuide();
            if ("floors" in ($this.options as any).properties) {
                $this.addGraphics(($this.options as any).properties.floors);
            }
            if ("floor" in ($this.options as any).properties) {
                $this.addGraphics(($this.options as any).properties.floor);
            }
            $this.addButtons();
            $this.addPowredBy();
            $this.initZoomAction();
            $this.resizeCanvas();
            callback();
        });
    }

    private addBackground() {
        const $this = this;
        if (($this.sprites as any).background.interactive) {
            $this.Container.removeChild(($this.sprites as any).background)
        }
        ($this.sprites as any).background.x = 0;
        ($this.sprites as any).background.y = 0;
        ($this.sprites as any).background.anchor = new PIXI.Point(0.5, 0.5);
        ($this.sprites as any).background.interactive = true;
        ($this.sprites as any).background.filters = [this.filterBackground];


        // const filter = new filters.ColorMatrixFilter();
        //$this.removeColorFromSprite(($this.sprites as any).background);
        ($this.sprites as any).background.on("pointerdown", (e) => {
            const x = e.data.global.x;
            const y = e.data.global.y;
            // console.log(`Point {${x}, ${y}}`);
            if ($this.startDrawing) {
                const xD3 = $this.getD3X(x);
                const yD3 = $this.getD3Y(y);
                $this.newGraphic.push([xD3, yD3, $this.lineTo]);
                $this.Container.removeChild($this.newGraphicObj[$this._counterGraphic]);
                $this.newGraphicObj[$this._counterGraphic] = $this.createGraph($this.newGraphic);
                $this.Container.addChild($this.newGraphicObj[$this._counterGraphic]);
            }
            $this.backgroundClicked = true;
        });

        ($this.sprites as any).background.mouseover = function () {
            ($this.options as any).onMouseOverBackground();
        };
        ($this.sprites as any).background.mouseout = function () {
            ($this.options as any).onMouseOutBackground();
        };
        $this.Container.addChild(($this.sprites as any).background);
    }

    public addGraphics(properties) {
        const $this = this;
        const Graphics = [];
        $this.removeGraphics();
        console.dir(properties);

        properties.forEach((G, k) => {
            const keyCords = "keyCoords" in ($this.options as any) ? ($this.options as any).keyCoords : "coords";
            const coords = G[keyCords];
            const Graph = $this.createGraph(coords, G);
            if (Graph) {
                (Graph as any).interactive = true;
                (Graph as any).alpha = G.opacity;
                (Graph as any).buttonMode = true;
                (Graph as any).mouseover = function () {
                    if (!$this.modeSearh && !$this.startDrawing) {
                        (this as any).alpha = 1;
                    }
                    ($this.options as any).onMouseOverPropertie(G);
                    /*let description = "";
                    (G.info.reference) ? description += "<div class=\"row\"><div class=\"col-12\"><p style=\"color:  #fff;font-weight:  bold;\">" + G.info.reference + "</p></div></div>" : "";
                    (!G.info.reference && G.info.title) ? description += "<div class=\"row\"><div class=\"col-12\"><p style=\"color:  #fff;font-weight:  bold;\">" + G.info.title + "</p></div></div>" : "";
                    description += "<div class=\"row\">";
                    let picture = (($this.options as any).hasOwnProperty("pictureNotFoundUrl")) ? ($this.options as any).pictureNotFoundUrl : "";
                    picture = (G.info.image && G.info.image.hasOwnProperty('small')) ? G.info.image.small : picture;
                    (picture) ? description += "<div class=\"col-6 pr-0\"><img class=\"img-fluid\" src='" + picture + "'></div>" : "";
                    description += "<div class=\"col-6\">";

                    (G.info.landUse) ? description += "<p style=\"color:#949b46\"><b style=\"color:#fff;\">" + ($this.options as any).plan_lang.vocation + ": </b> " + G.info.landUse.name + "</p>" : "";
                    (G.info.surface_terrain_show) ? description += "<p style=\"color:#949b46\"><b style=\"color:#fff;\">" + ($this.options as any).plan_lang.surface_du_lot + ": </b> " + G.info.surface_terrain_show + " <span>m²<span></p>" : "";
                    (G.info.surface_habitable_show) ? description += "<p style=\"color:#949b46\"><b style=\"color:#fff;\">" + ($this.options as any).plan_lang.surface_totale + ": </b> " + G.info.surface_habitable_show + " <span>m²<span></p>" : "";
                    if (G.info.pdfDownloadLink) {
                        let [firstPdf] = G.info.pdfDownloadLink;
                        (firstPdf) ? description += "<p style='color: #d1a9a4'>" + ($this.options as any).plan_lang.pdf + "</p>" : "";
                    }
                    description += "</div>";
                    description += "</div>";
                    if (description && !$this.startDrawing) {
                        $("canvas[title]").tooltip("option", "content", description);
                        $('body').removeClass('tooltip-hidden');
                    }*/
                };

                (Graph as any).mouseout = function () {
                    if (!$this.modeSearh && !$this.startDrawing) {
                        (this as any).alpha = G.opacity;
                    }
                };
                Graph.touchstart = function () {
                    Graph.dataTranslate = $this.zoomTrans;
                };
                Graph.pointerdown = function () {
                    Graph.dataTranslate = $this.zoomTrans;
                };
                Graph.click = Graph.tap = function () {
                    //if($this.isMobile) {
                    const k = Graph.dataTranslate.k == $this.zoomTrans.k;
                    let x = Graph.dataTranslate.x - $this.zoomTrans.x;
                    let y = Graph.dataTranslate.y - $this.zoomTrans.y;
                    x = (x > 0) ? x : x * -1;
                    y = (y > 0) ? y : y * -1;
                    const x_diff = x <= 10;
                    const y_diff = y <= 10;
                    if (k && x_diff && y_diff) {
                        ($this.options as any).onClickPropertie(G);
                    }
                    /*} else {
                        $this.showModalProperty(G, $this);
                    }*/
                };
                ($this as any).Container.addChild(Graph);
                Graphics.push({ G, Graph });
            }
        });
        $this.Graphics = Graphics;
    }

    private addGuide() {
        /*const $this = this;
        if(!$this.isMobile){
            if ($this.options.hasOwnProperty('showGuide')) {
                if (($this.options as any).showGuide) {
                    ($this.sprites as any).guide.x = $this.width / 2;
                    ($this.sprites as any).guide.y = $this.height / 2;
                    ($this.sprites as any).guide.anchor = new PIXI.Point(0.5, 0.5);
                    ($this.sprites as any).guide.interactive = true;
                    ($this.sprites as any).guide.filters = [this.filterBackground];
                    ($this.sprites as any).guide.on("pointerdown", (e) => {
                        // $this.ContainerGuide.removeChild(($this.sprites as any).guide);
                        $this.ContainerGuide.destroy({children: true})
                    });

                    ($this.sprites as any).guide.mouseover = function () {

                    };
                    ($this.sprites as any).guide.mouseout = function () {

                    };

                    $this.stage.addChild($this.ContainerGuide);
                    $this.ContainerGuide.addChild(($this.sprites as any).guide);
                }
            }
        }*/
    }

    private addPowredBy() {
        const $this = this;
        let style = new PIXI.TextStyle({
            fontFamily: "Arial", // Font Family
            fontSize: 14, // Font Size
            // fontStyle: "italic",// Font Style
            fontWeight: "bold", // Font Weight
            fill: ["#646565"], // gradient
            // stroke: "#ffffff",
            // strokeThickness: 5,
            // dropShadow: true,
            // dropShadowColor: "#000000",
            // dropShadowBlur: 4,
            // dropShadowAngle: Math.PI / 6,
            // dropShadowDistance: 6,
            // wordWrap: true,
            // wordWrapWidth: 440
        });

        $this.PowredByText = new PIXI.Text("Powred by ConceptLab", "arial");
        $this.PowredByText.anchor = new PIXI.Point(0.5, 0.5);
        $this.PowredByText.x = $this.width - 200;
        $this.PowredByText.y = $this.height - 50;
        $this.PowredByText.style = style;
        $this.ContainerButtons.addChild(this.PowredByText);
    }

    private initZoomAction() {
        const $this = this;
        $this.canvas = d3.select(`#${$this.selector} canvas`);
        $this.context = $this.canvas.node().getContext("2d");
        $this.widthCanvas = $this.canvas.property("width");
        $this.heightCanvas = $this.canvas.property("height");
        /*let touch_status = function(){
            console.log("touch start");
            d3.event.preventDefault();
            d3.event.stopPropagation();
            const d = d3.touches(this);
            console.dir(d);
        }
        $this.canvas.on("touchstart", () => {
            $this.move = false;
        });
        $this.canvas.on("touchmove", () => {
            $this.move = true;
        })
        $this.canvas.on("touchend", () => {
            $this.move = false;
        });*/

        $this.zoomHandler = d3.zoom()
            .scaleExtent((this.options as any).limitZoom)
            .translateExtent([[$this.widthExtent, $this.heightExtent], [$this.widthExtentMaximum, $this.heightExtentMaximum]])
            .on("start", () => {
                return $this.startZoomActions($this);
            })
            .on("zoom", () => {
                return $this.zoomActions($this);
            })
            .on("end", () => {
                return $this.endZoomActions($this);
            })
            .filter(() => {
                return !$this.D3Interval;
            });
        $this.initZommActionFunctionalities();
    }

    private initZommActionFunctionalities() {
        const $this = this;
        let data = { k: 1, x: 0, y: 0 };
        if ((this.options as any).hasOwnProperty("initialData")) {
            data = (this.options as any).initialData($this.width, $this.height);
        }
        if (isMobile()) {
            data = (this.options as any).initialDataMobile($this.width, $this.height);
        }
        // initX = $this.width - $this.background.width
        $this.canvas.call($this.zoomHandler).call($this.zoomHandler.transform, d3.zoomIdentity.translate(data.x, data.y).scale(data.k));
        $this.canvas.on("click", () => {
            // const x = (d3.event.x - $this.zoomTrans.x) / $this.zoomTrans.k;
            // const y = (d3.event.y - $this.zoomTrans.y) / $this.zoomTrans.k;
            console.log("test click");
        });
    }

    private zoomActions($this) {
        const x = d3.event.transform.x;
        const y = d3.event.transform.y;
        const k = d3.event.transform.k;
        $this.zoomTrans = d3.event.transform;
        console.dir($this.zoomTrans);

        // console.dir(d3.event.transform);
        // let translate = "translate(" + d3.event.translate + ")";
        // let scale = "scale(" + d3.event.scale + ")";
        // $this.canvas.attr("transform", translate + scale);
        $this.Container.scale.set(k);
        $this.Container.position.set(x, y);

        // ($this.sprites as any).background.x = x;
        // ($this.sprites as any).background.y = y;
    }

    private startZoomActions($this) {
        $this.isZooming = true;
    }

    private endZoomActions($this) {
        $this.isZooming = false;
    }


    /*private drawCircle(x, y) {
        const $this = this;
        const c = new PIXI.Graphics();
        c.lineStyle(2, 0xFF00FF);
        c.drawCircle(x, y, 5);
        c.endFill();
        $this.Container.addChild(c);
        $this.Circls.push(c);
    }*/

    private addButtons() {
        const $this = this;
        if ($this.Buttons.length) {
            $this.Buttons.map((e) => {
                $this.ContainerButtons.removeChild(e);
            })
            $this.Buttons = [];
        }
        let width = 150;
        let height = 50;
        let x = 10;
        let y = ($this as any).height - height - 20;
        let txt = "Start drawing";
        if ($this.startDrawing) {
            let txt = "Stop drawing";
        }
        const b = new Button(width, height, x, y, txt, null);
        $this.stage.addChild($this.ContainerButtons);
        //b.buttonMode = true;
        (b as any).on("click", () => {
            $this.startDrawing = !$this.startDrawing;
            if (!$this.startDrawing) {
                (b as any).text.text = "Start drawing";
                if ($this.newGraphic.length) {
                    ($this.options as any).onFinishDrawing($this.newGraphic);
                }
                $this.Container.removeChild($this.newGraphicObj[$this._counterGraphic]);
                $this._counterGraphic++;
                $this.newGraphic = [];

            } else {
                (b as any).text.text = "Stop drawing";
            }
        });
        $this.Buttons.push(b);
        width = 250;
        height = 50;
        x = 170;
        y = ($this as any).height - height - 20;
        const returnLastActionB = new Button(width, height, x, y, "Return to last action", null);
        //returnLastActionB.buttonMode = true;
        (returnLastActionB as any).on("click", () => {
            if ($this.newGraphic.length) {
                $this.newGraphic.splice(-1, 1);
                $this.Container.removeChild($this.newGraphicObj[$this._counterGraphic]);
                $this.newGraphicObj[$this._counterGraphic] = $this.createGraph($this.newGraphic);
                if ($this.newGraphicObj[$this._counterGraphic]) {
                    $this.Container.addChild($this.newGraphicObj[$this._counterGraphic]);
                }
            }
        });
        $this.Buttons.push(returnLastActionB);


        width = 150;
        height = 50;
        x = 450;
        y = ($this as any).height - height - 20;
        txt = "Move to";
        if ($this.lineTo) {
            txt = "Line to";
        }
        const actionButton = new Button(width, height, x, y, txt, null);
        (actionButton as any).on("click", () => {
            $this.lineTo = !$this.lineTo;
            console.log($this.lineTo);
            if (!$this.lineTo) {
                (actionButton as any).text.text = "Move to";
            } else {
                (actionButton as any).text.text = "Line to";
            }
        });
        $this.Buttons.push(actionButton);

        if (($this.options as any).hasOwnProperty('showButtonPlans')) {
            if (($this.options as any).showButtonPlans) {
                $this.ContainerButtons.addChild(actionButton);
                $this.ContainerButtons.addChild(returnLastActionB);
                $this.ContainerButtons.addChild(b);
            }
        }
    }

    public removeGraphics() {
        const $this = this;
        $this.Graphics.map((e) => {
            let { G, Graph } = e;
            $this.Container.removeChild(Graph);
        });

        $this.Graphics = [];
    }

    public addItems() {
        const $this = this;
        if ("floors" in ($this.options as any).properties) {
            $this.addGraphics(($this.options as any).properties.floors);
        }
        if ("floor" in ($this.options as any).properties) {
            $this.addGraphics(($this.options as any).properties.floor);
        }
    }

    public removeItems() {
        this.removeGraphics();
    }

    public addGraphicInfo(prp) {
        const $this = this;
        if ("floors" in ($this.options as any).properties) {
            (this.options as any).properties.floors.push(prp)
        }
        if ("floor" in ($this.options as any).properties) {
            (this.options as any).properties.floor.push(prp)
        }
    }

    private createGraph(coords, graphInfo = {}) {
        const $this = this;
        if (coords) {
            if (coords.length) {
                let color = 0xc10000;
                let opacity = .5;
                let lineSize = 5;
                if (($this.options as any).hasOwnProperty('defaultColor')) {
                    if (($this.options as any).defaultColor) {
                        color = ($this.options as any).defaultColor;
                    }
                }
                if (($this.options as any).hasOwnProperty('defaultOpacity')) {
                    if (($this.options as any).defaultOpacity) {
                        opacity = ($this.options as any).defaultOpacity;
                    }
                }
                if ((graphInfo as any).hasOwnProperty('info')) {
                    if ((graphInfo as any).info.landUse) {
                        if ((graphInfo as any).info.landUse.color) {
                            color = (graphInfo as any).info.landUse.color;
                            color = (color as any).replace(/#/gi, "0x");
                        }
                    }
                }
                if ((graphInfo as any).hasOwnProperty('color')) {
                    color = (graphInfo as any).color;
                    color = (color as any).replace(/#/gi, "0x");
                }
                if ((graphInfo as any).hasOwnProperty('lineSize')) {
                    lineSize = (graphInfo as any).lineSize;
                }
                const newGraphicObj = new PIXI.Graphics();
                newGraphicObj.beginFill(color, opacity);
                newGraphicObj.lineStyle(lineSize, 0x000000, opacity);
                let firstCoord = [];
                coords.map((e) => {
                    let [x, y, lineTo] = e;
                    if (lineTo == undefined) {
                        lineTo = true;
                    }
                    if (lineTo) {
                        if (!firstCoord.length) {
                            firstCoord = e;
                            newGraphicObj.moveTo(x, y);
                        } else {
                            newGraphicObj.lineTo(x, e[1]);
                        }
                    } else {
                        if (firstCoord) {
                            const [firstX, firstY] = firstCoord;
                            newGraphicObj.lineTo(firstX, firstY);
                            firstCoord = [];
                        }
                        newGraphicObj.moveTo(x, e[1]);
                    }
                });
                newGraphicObj.endFill();
                return newGraphicObj;
            }
        }
        return false;
    }

    public getD3X(x: number) {
        const $this = this;
        return (x - $this.zoomTrans.x) / $this.zoomTrans.k;
    }

    public getD3Y(y: number) {
        const $this = this;
        return (y - $this.zoomTrans.y) / $this.zoomTrans.k;
    }

    public resizeCanvas() {
        const $this = this;
        $this.rendererResize($this);
        window.addEventListener('resize', () => {
            return $this.rendererResize($this);
        });
        window.addEventListener('deviceOrientation', () => {
            return $this.rendererResize($this);
        });
    };

    public rendererResize($this) {
        let wwidth = document.getElementById(`${$this.selector}`).clientWidth;
        let wheight = $this.height;
        if (isMobile() || ($this.options as any).fullSizeShow) {
            wwidth = window.innerWidth;
            wheight = window.innerHeight;
        }

        let ratio = Math.min(wwidth / $this.width,
            wheight / $this.height);
        if (ratio > 1) {
            ratio = 1;
        }
        $this.Container.scale.x = ratio;
        $this.Container.scale.y = ratio;
        $this.ContainerButtons.scale.x = ratio;
        $this.ContainerButtons.scale.y = ratio;
        $this.addButtons();
        $this.PowredByText.x = wwidth - 200;
        $this.PowredByText.y = wheight - 50;
        // Update the renderer dimensions
        if (!$this.isMobile) {
            $this.renderer.resize(wwidth, wheight);
        } else {
            let width = Math.ceil(wwidth * ratio);
            let height = Math.ceil(wheight * ratio);
            $this.renderer.resize(width, height);
        }
        if (!$this.isMobile) {
            if ($this.options.hasOwnProperty('showGuide')) {
                if (($this.options as any).showGuide) {
                    //($this.sprites as any).guide.x = width / 2;
                    //($this.sprites as any).guide.y = height / 2;
                    //($this.sprites as any).scale.x = ratio;
                    //($this.sprites as any).scale.y = ratio;
                    //$this.ContainerGuide.scale.x = ratio;
                    //$this.ContainerGuide.scale.y = ratio;
                    //if (($this.sprites).guide.width > width) {
                    //($this.sprites).guide.width = width;
                    //}
                }
            }
        }
        $this.canvas.call($this.zoomHandler).call($this.zoomHandler.transform, d3.zoomIdentity.translate($this.zoomTrans.x, $this.zoomTrans.y).scale($this.zoomTrans.k));

    };

    private removeColorFromBackground() {
        const $this = this;
        $this.removeColorFromSprite(($this.sprites as any).background);
    }

    private addColorToBackground() {
        const $this = this;
        $this.removeFiltersFromSprite(($this.sprites as any).background);
    }

    private removeColorFromSprite(sprite) {
        this.filterBackground.desaturate();
    }

    private removeFiltersFromSprite(sprite) {
        this.filterBackground.reset();
    }

    public search(search, searchOptions) {
        if("search" in (this.options as any)){
            this._modeSearh = search;
            (this.options as any).search(this.Graphics, search, searchOptions);
            if (search) {
                this.removeColorFromBackground();
            } else {
                this.addColorToBackground();
            }
        }
    }
    get modeSearh(): boolean {
        return this._modeSearh;
    }

    set modeSearh(value: boolean) {
        this._modeSearh = value;
    }
}

export {
    Zoomer
}