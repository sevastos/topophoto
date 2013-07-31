
"use strict";

var GEOLAT = 0;
var GEOLON = 1;

var PHOTO_STATUS_DEFAULT = 0;
var PHOTO_STATUS_ACTIVE = 1;
var PHOTO_STATUS_HOVER = 2;


var DIMS = ['lat', 'lon', 'lan'];
var DIMS2 = ['geolan', 'geolon', 'geolat'];
var DIMAP = {
    'lat': 'lat',
    'lon': 'lon',
    'lan': 'lat',
    'geolat': 'lat',
    'geolan': 'lat',
    'geolon': 'lon'
};

// Multi-class manipulation to avoid browser inconsistencies
// https://gist.github.com/sevastos/6123053
['add', 'remove'].forEach(function(action) {
  DOMTokenList.prototype[action + 'Many'] = function() {
    for (var i = arguments.length - 1; i >= 0; i--) {
      this[action](arguments[i]);
    };
  }  
});

function getFlickrPics(opts){
    var tags = (opts['text']?opts['text']+',':'')+encodeURIComponent('geo:lon');
    //var pic= $("#box").val();
    // geo:lat= geotagged comma delimited
    var requestUrl = 'http://api.flickr.com/services/feeds/photos_public.gne?tags='
                   + tags + "&tagmode=all&format=json&jsoncallback=?";

    var extraInfo = ['geo', 'url_sq', 'url_m', 'path_alias'];

    // Extra search params
    var params = [];
    if (opts && opts['text']) {
        params.push('text=' + encodeURIComponent(opts['text']));
    }
    if (opts && opts['lat'] && opts['lon']) {
        params.push('lat=' + opts['lat']);
        params.push('lon=' + opts['lon']);
        params.push('radius=' + (opts['radius'] || 32));
    }

    if (params.length > 0) {
        params = params.join('&') + '&';
    } else {
        params = '';
    }

    // Flickr commons license only
    var is_commons = 'true';

    var requestUrl = 'http://ycpi.api.flickr.com/services/rest/?method=flickr.photos.search&api_key=c7932da5b1a01a6c4ce363ff6077090e&'+params+'has_geo=1&is_commons='+is_commons+'&extras='+extraInfo.join(',')+'&format=json&jsoncallback=?';

    $.getJSON(requestUrl, handleFlickrPics)
};

function handleFlickrPics(pics) {
    var flickrPics = {};
    var flickrPicsIds = [];

    if (!pics || !pics.photos || !pics.photos.photo) {
        alert('No photos');
        console.log(pics);
        return;
    } 

    $.each(pics.photos.photo, function(index, pic) {
        var id = pic.id;
        var url = 'http://www.flickr.com/photos/' + (pic.url_path || pic.owner) + '/' + id + '/';
        flickrPicsIds.push(id);
        flickrPics[id] = {
            item: pic,
            url: url,
            lat: pic.latitude,
            lon: pic.longitude
        };
        addPhoto(id, url, pic.url_sq, pic.url_m, pic.latitude, pic.longitude, pic.title);
    });

    refreshMapMarkers();
}

function addPhoto(id, url, thumb, img, lat, lon, title) {
    // check img = uri || data ?

    // add marker
    photoLib[id] = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [lon, lat]
        },
        properties: {
            'marker-color': '#f65857',
            //'marker-symbol': 'star-stroked',
            'title': (title || id), // + ' (' + [lon, lat].join(',') + ')',
            'image': img,
            'thumb': thumb,
            'url': url || ''
        }
    };

}

function refreshMapMarkers(data) {
    console.log('refreshed');
    map.markerLayer.setGeoJSON({
        type: 'FeatureCollection',
        features: $.map(data || photoLib, function(k, v) {
                      return [k];
                  })
    });
}

// APP
var photoLib = {};

/// MAP      
var map = L.mapbox.map('map', 'sevm.map-pfi9rnav', {zoomControl: true})
            .setView([26, 6], 2);

map.on('ready', function() {
    imagesLoaded(document.querySelectorAll('.leaflet-tile'))
        .on('always', function(instance) {
            console.log('images loaded');
            document.getElementById('map').classList.add('ready'); // 'animated', 'mapLoaded');
        });
});

map.on('error', function(e) {
  console.log('oopsy', e);
});

map.markerLayer.on('click', function(e) {
  var id = e.layer.feature.properties.id;
  var photoEl = document.getElementById('photo-' + id);
  TpApp.cache.activePhoto = id;
  TpApp.ui.scrollTo(id, 1000);

  [].forEach.call(
    document.querySelectorAll('.photolist li.active'), 
    function(el){
      el.classList.removeMany('active', 'hover');
    }
  );

  photoEl.classList.remove('hover');
  setTimeout(function() {
    photoEl.classList.add('active');
  }, 10);

  // zoom to photo location
  var zoom = map.getZoom();
  zoom = (zoom > 6 ? zoom : 6);
  var latlng = e.layer.getLatLng();
  latlng = {
      lat: latlng.lat + 2,
      lng: latlng.lng
  };
  map.setView(latlng, zoom);

  TpApp.map.compile();

});

map.markerLayer.on('mouseover', function(e) {
  var id = e.layer.feature.properties.id;
  var photoEl = document.getElementById('photo-' + id);
  TpApp.ui.scrollTo(id, 1000);
  photoEl.classList.add('hover');  


    //e.layer.openPopup();
    // domCache['thumbtip-img']
    //     .attr('src', e.layer.feature.properties.thumb);
    // domCache['thumbtip']
    //     .finish()
    //     .delay(150)
    //     .fadeIn();
});
map.markerLayer.on('mouseout', function(e) {
  var photoEl = document.getElementById('photo-' + e.layer.feature.properties.id);
  photoEl.classList.remove('hover');

    //e.layer.closePopup();
    // domCache['thumbtip']
    //     .finish()
    //     .fadeOut();
});
map.on('popupclose', function(e) {
  delete TpApp.cache.activePhoto;
  [].forEach.call(
    document.querySelectorAll('.photolist li.active'), 
    function(el){
      el.classList.removeMany('active', 'hover');
    }
  );
  TpApp.map.compile();
});
// Add custom popups to each using our custom feature properties
map.markerLayer.on('layeradd', function(e) {
    var marker = e.layer,
        feature = marker.feature;




    return; //flickr only follows
    // Create custom popup content
    var popupContent =  '<a target="_blank" rel="external" class="popup" href="' + feature.properties.url + '">' +
                            '<img class="animated" src="' + feature.properties.image + '">' +
                        '   <br/><span>' + feature.properties.title + '</span>' +
                        '</a>';

    // http://leafletjs.com/reference.html#popup
    marker.bindPopup(popupContent,{
        closeButton: false,
        minWidth: 260
    });
    // domCache['thumbtip']
    //     .finish()
    //     .fadeOut();
});

// Photo wrapper object
var TpPhoto = function(file, loc) {
  this.file = file;
  if (loc) {
    this.loc = loc;
  }
  return this;
};

TpPhoto.prototype.getLocString = function() {
  return !!this.loc ? this.loc.join(',') : '';
}

// next(generatedElement);
TpPhoto.prototype.generateDomEl = function(next) {
  var el = document.createElement('li');
  el.classList.addMany('photolist-item', 'animated', 'slideDownTiny');

  var html = [
    '<div class="photolist-info">',
    ' <span class="photolist-name">' + Helpers.text.safe(this.file.name) + '</span>',
    ' <span class="photolist-size">' +
     '<span class="icon-storage"></span>' +
      Helpers.text.smartBytes(this.file.size) +
    '</span>',
    ' <span class="photolist-coords">' +
     '<span class="icon-location-2"></span>' +
      Helpers.gps.prettyCoords(this.loc[GEOLAT]) + ' &nbsp; ' +
      Helpers.gps.prettyCoords(this.loc[GEOLON]) +
    ' </span>' +
    '</div>'//,
//    '<div class="photolist-img-wrap">',
//    ' <img src="http://lorempixel.com/500/212/?176" class="photolist-img">',
//    '</div>'
  ];

  loadImage(
    this.file,
    function (img) {
      //console.log('IMG', img);
      if(img.type === "error") {
          console.log("Error loading image " + img);
      } else {
          img.classList.add('photolist-img');
          el.innerHTML = html.join('');
          var imgWrap = document.createElement('div');
          imgWrap.classList.add('photolist-img-wrap');
          imgWrap.appendChild(img);
          el.appendChild(imgWrap);
          next(el);
      }
    },
    {
      maxWidth: 100,
      maxHeight: 100,
      crop: true,
      canvas: true
    }
  );

  //return el;
}
var xb;

// Photo lib
var TpApp = {
  // Caching
  cache: {},
  // Vars
  _photosStore: [],
  // Drag and rop
  dnd: {
    dragOutTimer: null,
    handleDrop: function(e) {
      TpApp.cache['body'].classList.remove('dragging');
      TpApp.cache['dropzone'].classList.remove('hover');     
      TpApp.cache['welcomemsg'].classList.add('hidden');
      //show map
      TpApp.cache['map'].classList.addMany('animated', 'mapLoaded');

      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.preventDefault();

      if (!e.dataTransfer || !e.dataTransfer.files) {
        console.log('No files');
        return false;
      }

      var files = e.dataTransfer.files;
      TpApp.file.processAll(files);

      return false;
    },
    handleOver: function(e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    },
    handleEnter: function(e) {
      console.log('drag enter!!, doc'); //, e
      if (TpApp.dnd.dragOutTimer) {
        clearTimeout(TpApp.dnd.dragOutTimer);
      }
      TpApp.cache['body'].classList.add('dragging');
      TpApp.cache['dropzone'].classList.add('hover');
    },
    handleLeave: function(e) {
      if (e.toElement.id === 'photo-dropzone') {
        console.log('drag leave!!, doc [not dropzone]', e.toElement.id); //, e
        TpApp.dnd.dragOutTimer = setTimeout(function() {
          TpApp.cache['body'].classList.remove('dragging');
          TpApp.cache['dropzone'].classList.remove('hover');
        }, 100);           
      } else {
        console.log('drag leave!!, doc [dropzone]', e.toElement.id); //, e
      }
    }
  },
  // Files
  file: {
    // all
    processAll: function(files) {
      for (var i = 0, f; f = files[i]; i++) {
        // Read the File objects in this FileList.
        TpApp.file.process(f);
      }
    },
    // each
    process: function(file) {
      //console.log('Process file: ', file.name, file);
      TpApp.photo.getLatLng(file, function(file, loc) {
        TpApp.photo.addToList(new TpPhoto(file, loc));
        TpApp.map.compile();
      });
    }
  },
  // Manage the internal array of photos
  photosStore: {
    add: function(photo) {
      var index = TpApp.photosStore.has(photo);
      console.log('found file', index)

      if (index !== false) {
        return [false, index];
      }
      console.log('%cadded to internal array', 'font-weight: bold');
      var index = TpApp._photosStore.push(photo) - 1;
      return [true, index];
    },
    get: function(id) {
      return TpApp._photosStore[id];
    },
    /**
     * Check the existance of a photo
     * @param  {Photo} photo
     * @return {Boolean|Number} The index number of the file if exists, false if otherwise
     */
    has: function(photo) {
      for (var i = TpApp._photosStore.length - 1; i >= 0; i--) {
        var aPhoto = TpApp._photosStore[i];

        // Compare files
        if (  aPhoto.file.name !== photo.file.name
           || aPhoto.file.size !== photo.file.size
           || typeof aPhoto.file.lastModifiedDate !== typeof photo.file.lastModifiedDate
           || (aPhoto.file.lastModifiedDate && 
                (+aPhoto.file.lastModifiedDate !== +photo.file.lastModifiedDate)
              )
        ){
          continue;
        }

        // Compare locations
        if (aPhoto.getLocString() !== photo.getLocString()) {
          continue;
        }

        // Same file
        return i;
      };

      return false;
    },

    count: function() {
      return TpApp._photosStore.length;
    },

  },
  // Photos
  photo: {
    addToList: function(photo) {
      console.log('Add to list: ', photo.file.name, photo.file);

      var res = TpApp.photosStore.add(photo);
      var id = res[1];
      photo.id = id;
      if (res[0] === true) {
        // Just added
        document.body.classList.remove('hide-photolist');
        photo.generateDomEl(function(el) {
          TpApp.cache.photolist.classList.remove('expandExtra');
          TpApp.cache.photolist.classList.add('expandExtra');
          setTimeout(function(el, id) {
            TpApp.cache.photolist.classList.remove('expandExtra');
            el.id = 'photo-' + id;
            el.classList.add('animated');
            TpApp.cache.photolist.appendChild(el);
            TpApp.ui.scrollTo(id, 1000);
          }.bind(this, el, id), 750);
        });
      } else {
        // Already exists
        var pcl = document.getElementById('photo-' + id);
        pcl.classList.removeMany('slideDownTiny', 'animated', 'flash');
        setTimeout(function(pcl) {
           pcl.classList.addMany('animated', 'flash');
        }.bind(this, pcl), 10);
      }
    },
    // next(file, location)
    getLatLng: function(file, next) {
      loadImage.parseMetaData(file, function(data) {
        if (!data) {
          next(data, null);  
          return;
        }
        console.log('Process getLatLng');
        var orientation = data.exif.get('Orientation');
        var loc = [];
        loc[GEOLAT] = Helpers.gps.coordsToDec(data.exif.get('GPSLatitude'), data.exif.get('GPSLatitudeRef'));
        loc[GEOLON] = Helpers.gps.coordsToDec(data.exif.get('GPSLongitude'), data.exif.get('GPSLongitudeRef'));

        console.log('Exif', orientation, loc);
        next(file, loc);
      }, {
        disableExifThumbnail: true
      });
    }
  },
  // Map
  map: {
    compile: function() {
      var lib = [];
      for (var id = TpApp._photosStore.length - 1; id >= 0; id--) {
        var photo = TpApp._photosStore[id];
        lib.push(TpApp.map.createMarkerFromPhoto(photo, id));
      }

      map.markerLayer.setGeoJSON({
        type: 'FeatureCollection',
        features: $.map(lib, function(k, v) {
                    return [k];
                  })
      });

    },
    createMarkerFromPhoto: function(photo, id) {
      var markerColor = '#F65857';

      // switch (photo.status) {
      //   case PHOTO_STATUS_ACTIVE:
      //     markerColor = '#7CB9FC';
      //     break;
      //   case PHOTO_STATUS_HOVER:
      //     markerColor = '#cccccc';
      //     break;
      //   default:
      //     markerColor = '#f65857';
      //     break;
      // }

      if (typeof TpApp.cache.activePhoto !== 'undefined' && TpApp.cache.activePhoto === id) {
        markerColor = '#7CB9FC';
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [photo.loc[GEOLON], photo.loc[GEOLAT]]
        },
        properties: {
          'id': id,
          'marker-color': markerColor,
          'title': photo.file.name + ' #' + (id + 1),
          'lon': photo.loc[GEOLON],
          'lat': photo.loc[GEOLAT]
        }
      };
    }
  },
  // UI
  ui: {
    scrollTo: function(photoId, duration) {
      var pl = document.getElementById('photolist').offsetParent;
      var photo = document.getElementById('photo-' + photoId);

      var photoListViewTop = pl.scrollTop;
      var photoListViewBottom = pl.scrollTop + pl.offsetHeight;

      var photoTop = photo.offsetTop;
      var photoBottom = photoTop + photo.offsetHeight;


      var deltaScrollTop = 0;
      var absTarget = photoTop;
      var dir = '';
      
      if (photoTop < photoListViewTop) {
        //scroll up
        dir = '-';
        deltaScrollTop = parseInt(photoTop - photoListViewTop); // extra gutter?
      } else if (photoBottom > photoListViewBottom) {
        //scroll down
        dir = '+';
        deltaScrollTop = parseInt(photoBottom - photoListViewBottom); //extra gutter?
      } else {
        // in view
        //deltaScrollTop = 0;
      }


      var fps = 30;
      var steps = (fps * 1e3) / duration;
      var stepTime = duration / (fps * 1e3);
      var step = deltaScrollTop / steps;
      var interval;

      if (TpApp.cache.interval) {
        clearInterval(TpApp.cache.interval);
      }
      if (deltaScrollTop === 0) {
        return;
      }

      TpApp.cache.interval = setInterval(function(el, step, absTarget, dir) {

        var prev = el.scrollTop;
        el.scrollTop += step;
        if (prev === el.scrollTop) {
          clearInterval(TpApp.cache.interval);
        }
        switch (dir) {
          case '-':
            if (el.scrollTop <= absTarget) {
              clearInterval(TpApp.cache.interval);
            }
            break;
          case '+':
            if (el.scrollTop >= absTarget) {
              clearInterval(TpApp.cache.interval);
            }
            break;
          default:
            clearInterval(TpApp.cache.interval);
        }

      }.bind(this, pl, step, absTarget, dir), stepTime);

    }
  }

};

var Helpers = {
  detection: {
    hasFileAPI : function() {
      return window.FileList && "ondrop" in document.createElement('div');
    }
  },
  gps: {
    /**
     * Convert geo cords to decimal degrees
     * @param  {Array} coords [degrees, minutes, seconds]
     * @param  {String} reference [N|S|W|E] Reference cardinal direction
     * @return {Number} Decimal degrees 
     */
    coordsToDec: function(coords, reference) {
      var degrees =  (coords[0] || 0)          // degrees
                  + ((coords[1] || 0) / 60)    // minutes
                  + ((coords[2] || 0) / 3600)  // seconds
                  ;
      if (reference === 'S' || reference === 'W') {
        degrees *= -1;
      }
      return degrees;
    },
    decToCoords: function(dec) {
      return [
        parseInt(dec),
        (dec = dec % 1 * 60, parseInt(dec)),
        dec % 1 * 60
      ];
    },
    prettyCoords: function(coords, hideSeconds) {
      var c = Helpers.gps.decToCoords(coords);
      console.log('prettyCoords:', coords , '=>', c);
      return [
        c[0].toFixed(0) + '°',
        c[1].toFixed(0) + "'",
        (hideSeconds ? '' : c[2].toFixed(0) + '"')
      ].join(' ');
    }
  },
  text: {
    safe: function(input) {
      return document.createTextNode(input).textContent;
    },
    smartBytes: function(bytes) {
      var sizes = ['T', 'G', 'M', 'K'];
      var size = '';
      while(sizes.length) {
        size = sizes.pop();
        bytes /= 1024;
        if (bytes < 1024) {
          return bytes.toFixed(2) + ' ' + size + 'B';
        }
      }
      return bytes.toFixed(2) + ' ' + size + 'B';
    }
  },
  ui: {
    getScrollTop: function() {
      pl.offsetParent.scrollTop;
    }
  }
};

// INIT APP
$(document).ready(function(){
  TpApp.cache['body'] = document.body;
  TpApp.cache['photolist'] = document.getElementById('photolist');
  TpApp.cache['dropzone'] = document.getElementById('photo-dropzone');
  TpApp.cache['welcomemsg'] = document.getElementById('welcome-msg');
  TpApp.cache['map'] = document.getElementById('map');

  if (!Helpers.detection.hasFileAPI()) {
    TpApp.cache['body'].classList.add('no-FileAPI');
  }

  //TpApp.cache['thumbtip'] = document.getElementById('thumbtip');
  //TpApp.cache['thumbtip-img'] = document.querySelector('#thumbtip img');
  
  // Flickr form
  $('#search').submit(function(e){
    e.preventDefault();
    photoLib = {};

    var opts = {
        text: $('#q').val()
    };

    var mapLatLng = map.getCenter();
    if (map.getZoom() > 10) {
        opts.lat = mapLatLng.lat;
        opts.lon = mapLatLng.lng;
        opts.radius = 32;
    }
    getFlickrPics(opts);
    return false;
  });

  // Drag and drop
  document.addEventListener("dragenter", TpApp.dnd.handleEnter, false);
  document.addEventListener("dragleave", TpApp.dnd.handleLeave, false);
  document.addEventListener("dragover", TpApp.dnd.handleOver, false);
  TpApp.cache['dropzone']
          .addEventListener("dragover", TpApp.dnd.handleOver, false);
  TpApp.cache['dropzone']
          .addEventListener('drop', TpApp.dnd.handleDrop, false);





});
