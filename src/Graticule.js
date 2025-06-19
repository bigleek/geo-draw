import {useEffect, useState} from 'react';
import {useMap} from 'react-leaflet';
import L from 'leaflet';
import AutoGraticule from "leaflet-auto-graticule";

const Graticule = () => {
    const map = useMap();
    const [showGraticule, setShowGraticule] = useState(false);
    const [graticuleLayer, setGraticuleLayer] = useState(false);

    // 创建控制按钮
    useEffect(() => {
        if (!map) return;

        // 创建自定义控制按钮
        const ToggleControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', '', container);

                // button.innerHTML = showGraticule ? '🕸️' : '🌐';
                button.innerHTML = showGraticule ? '🌐' : '🌐';
                // 调整一下字体大小让它看起来像图标
                button.style.fontSize = '20px';
                button.href = '#';
                button.title = 'Toggle Graticule';
                button.style.cssText = 'width:auto; height:auto; padding:0 8px; font-size:16px; line-height:26px;';

                L.DomEvent.on(button, 'click', L.DomEvent.stop)
                    .on(button, 'click', () => {
                        setShowGraticule(!showGraticule);
                    });

                return container;
            }
        });

        const control = new ToggleControl();
        control.addTo(map);

        // 清理函数
        return () => {
            map.removeControl(control);
        };
    }, [map, showGraticule]);

    // 处理格网图层的添加/移除
    useEffect(() => {
        if (!map) return;

        // 配置格网
        const options = {
            redraw: 'moveend',
            minDistance: 100,
            showLabel: true,
            fontSize: '12px',
            fontColor: '#333',
            dashArray: [2, 6]
        };

        // 显示格网
        if (showGraticule && !graticuleLayer) {
            const layer = new AutoGraticule(options).addTo(map);
            layer.addTo(map);
            setGraticuleLayer(layer);
            // 在地图中心添加一个圆点
            var centerMarker = L.circleMarker(map.getCenter(), {
                color: 'blue',        // 圆的边框颜色
                fillColor: '#3498db',  // 圆的填充颜色
                fillOpacity: 0.6,     // 填充透明度
                radius: 20            // 半径
            }).addTo(map);

            // 监听地图移动事件，更新圆点位置
            map.on('move', function () {
                centerMarker.setLatLng(map.getCenter());
            });


        }
        // 隐藏格网
        else if (!showGraticule && graticuleLayer) {
            map.removeLayer(graticuleLayer);
            setGraticuleLayer(null);
        }

        // 清理函数
        return () => {
            if (graticuleLayer && map.hasLayer(graticuleLayer)) {
                map.removeLayer(graticuleLayer);
            }
        };
    }, [map, showGraticule, graticuleLayer]);

    return null;
};

export default Graticule;