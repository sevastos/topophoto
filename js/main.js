
"use strict";

var GEOLAT = 0;
var GEOLON = 1;

// Multi-class manipulation to avoid browser inconsistencies
// https://gist.github.com/sevastos/6123053
['add', 'remove'].forEach(function(action) {
  DOMTokenList.prototype[action + 'Many'] = function() {
    for (var i = arguments.length - 1; i >= 0; i--) {
      this[action](arguments[i]);
    };
  }
});

// APP
var photoLib = {};

/// MAP
var map = L.mapbox.map('map', 'sevm.map-pfi9rnav', {zoomControl: true})
            .setView([26, 6], 2);

map.on('ready', function() {
    imagesLoaded(document.querySelectorAll('.leaflet-tile'))
        .on('always', function(instance) {
            document.getElementById('map').classList.add('ready');
        });
});

map.markerLayer.on('click', function(e) {
  e.layer.unbindPopup();
  var id = e.layer.feature.properties.id;
  TpApp.cache.activePhoto = id;
  var photoEl = document.getElementById('photo-' + id);
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

  map.setView(latlng, zoom, {animate: true});

  TpApp.map.compile();

});

map.markerLayer.on('mouseover', function(e) {
  var id = e.layer.feature.properties.id;
  var photoEl = document.getElementById('photo-' + id);
  TpApp.ui.scrollTo(id, 1000);
  photoEl.classList.add('hover');
});

map.markerLayer.on('mouseout', function(e) {
  var photoEl = document.getElementById('photo-' + e.layer.feature.properties.id);
  photoEl.classList.remove('hover');
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

  el.addEventListener('click', function(e) {
    if(e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    var photoId = (e.target || e.srcElement).offsetParent.getAttribute('data-id');
    if (!isNaN(photoId)) {
      TpApp.ui.zoomToMarker(parseInt(photoId) + 1);
    }
  }, false);

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
    '</div>'
  ];

  loadImage(
    this.file,
    function (img) {
      if(img.type !== "error") {
          img.classList.add('photolist-img');
          //el.innerHTML = html.join('');
          var imgWrap = document.createElement('div');
          imgWrap.classList.add('photolist-img-wrap');
          imgWrap.appendChild(img);
          var anchor = document.createElement('a');
          anchor.href = '#';
          anchor.innerHTML = html.join('');
          anchor.appendChild(imgWrap);
          el.appendChild(anchor);
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

}


// Photo lib
var TpApp = {
  // Caching
  cache: {
    'atLeastOneGood': false,
    'notifId': 0,
  },
  // Vars
  _photosStore: [],
  _markersStore: [],
  // Drag and rop
  dnd: {
    dragOutTimer: null,
    handleDrop: function(e) {
      TpApp.cache['body'].classList.remove('dragging');
      TpApp.cache['dropzone'].classList.remove('hover');

      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.preventDefault();

      if (!e.dataTransfer || !e.dataTransfer.files) {
        Helpers.log('No files');
        return false;
      }

      var files = e.dataTransfer.files;
      TpApp.file.processAll(files);

      return false;
    },
    handleOver: function(e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    handleEnter: function(e) {
      if (TpApp.dnd.dragOutTimer) {
        clearTimeout(TpApp.dnd.dragOutTimer);
      }
      TpApp.cache['body'].classList.add('dragging');
      TpApp.cache['dropzone'].classList.add('hover');
    },
    handleLeave: function(e) {
      if (e.toElement.id === 'photo-dropzone') {
        TpApp.dnd.dragOutTimer = setTimeout(function() {
          TpApp.cache['body'].classList.remove('dragging');
          TpApp.cache['dropzone'].classList.remove('hover');
        }, 100);
      }
    }
  },
  traditionalUpload: {
    init: function() {
      //attach events
      TpApp.cache['welcomemsg'].addEventListener('click', function(e){
        if (e.stopPropagation) {
          e.stopPropagation();
        }
        e.preventDefault();

        TpApp.traditionalUpload.showFileDialog();
      }, true);
      document.getElementById('upload-more').addEventListener('click', TpApp.traditionalUpload.showFileDialog);

      TpApp.cache['uploadfallback'].addEventListener('change', TpApp.traditionalUpload.processFiles);

    },
    showFileDialog: function() {
      Helpers.ui.simulateClick('upload-fallback');
    },
    processFiles: function() {
      TpApp.file.processAll(TpApp.cache['uploadfallback'].files);
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
      try {
        if (!file.name  || ['jpg', 'jpeg'].indexOf(file.name.split('.').pop().toLowerCase()) === -1) {
          TpApp.file.processError('nojpeg', file);
          return;
        }

        TpApp.photo.getLatLng(file, function(file, loc) {
          if (typeof loc === 'string') {
            TpApp.file.processError(loc, file);
            return;
          }
          if (TpApp.cache['atLeastOneGood'] === false) {
            TpApp.ui.showMap();
            TpApp.cache['atLeastOneGood'] = true;
          }

          TpApp.photo.addToList(new TpPhoto(file, loc));
          TpApp.map.compile();
        });
      } catch(e) {
        TpApp.file.processError(e, file);
      }
    },
    processError: function(e, file) {
      var msg = '';
      switch(e){
        case 'nojpeg':
          msg = 'is not a JPEG image';
        case 'noexif':
          msg = 'has no EXIF or GPS tags';
        case 'nogeotag':
        case 'parsingprob':
        default:
          msg = 'is not a Geotagged photo';
          //msg = 'failed for an unknown reason';
      }

      msg = '<strong>'+Helpers.text.safe(file.name) + '</strong> ' + msg;
      var notifId = ++TpApp.cache['notifId'];
      var notifEl = document.createElement('span');
      notifEl.setAttribute('id', 'notif-' + notifId);
      notifEl.classList.addMany('notification', 'slideOutUp', 'delayed', 'animated');
      notifEl.innerHTML = msg;
      TpApp.cache['notifcnt'].appendChild(notifEl);
      TpApp.cache['notifwrap'].classList.remove('invisible');

      setTimeout(function(id) {
        document.getElementById('notif-'+id).remove();
        if (document.querySelectorAll('.notification').length === 0) {
          TpApp.cache['notifwrap'].classList.add('invisible');
        }
      }.bind(this, notifId), 1800);

      Helpers.log('Invalid photo', e);
    }
  },
  // Manage the internal array of photos
  photosStore: {
    add: function(photo) {
      var index = TpApp.photosStore.has(photo);
      if (index !== false) {
        return [false, index];
      }
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
            el.setAttribute('id', 'photo-' + id);
            el.setAttribute('data-id', id);
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
    // Cb: next(file, location)
    getLatLng: function(file, next) {
      loadImage.parseMetaData(file, function(data) {
        if (!data) {
          next(file, 'parsingprob');
          return;
        }

        if (typeof data.exif === 'undefined' || !data.exif || typeof data.exif['get'] !== 'function') {
          next(file, 'noexif');
          return;
        }

        //var orientation = data.exif.get('Orientation');
        var loc = [];
        loc[GEOLAT] = Helpers.gps.coordsToDec(data.exif.get('GPSLatitude'), data.exif.get('GPSLatitudeRef'));
        loc[GEOLON] = Helpers.gps.coordsToDec(data.exif.get('GPSLongitude'), data.exif.get('GPSLongitudeRef'));

        if (typeof loc[GEOLAT] === 'number' && typeof loc[GEOLON] === 'number') {
          next(file, loc);
          return;
        } else {
          next(file, 'nogeotag');
          return;
        }

      }, {
        disableExifThumbnail: true,
        orientation: false
      });
    }
  },
  // Map
  map: {
    compile: function() {
      var lib = TpApp._markersStore || [];
      for (var id = TpApp._photosStore.length - 1; id >= 0; id--) {
        var photo = TpApp._photosStore[id];
        if (typeof photo['marker'] === 'undefined') {
          photo['marker'] = TpApp.map.createMarkerFromPhoto(photo, id);
          lib[id] = photo['marker'];
        } else {
          if (typeof TpApp.cache.activePhoto !== 'undefined' && TpApp.cache.activePhoto === id) {
            photo['marker']['properties']['marker-color'] = '#7CB9FC';
          } else {
            photo['marker']['properties']['marker-color'] = '#F65857';
          }
        }
      }

      if (TpApp._markersStore.length !== 0) {
        map.markerLayer.setGeoJSON(lib);
      }
    },
    createMarkerFromPhoto: function(photo, id) {
      var markerColor = '#F65857';

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
    zoomToMarker: function(id) {
      var el = document.querySelector('#map .leaflet-marker-icon[title$="#'+parseInt(id)+'"]');
      Helpers.ui.simulateClick(el);
    },
    showMap: function() {
      TpApp.cache['welcomemsg'].classList.add('hidden');
      TpApp.cache['map'].classList.addMany('animated', 'mapLoaded');
    },
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
  log : function() {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log.apply(console, arguments);
    }
  },
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
      if (!coords || coords.length !== 3) {
        return false;
      }
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
      return [
        c[0].toFixed(0) + '°',
        c[1].toFixed(0) + "'",
        (hideSeconds ? '' : c[2].toFixed(0) + '"')
      ].join(' ');
    }
  },
  text: {
    safe: function(input) {
      var el = document.createElement('div');
      el.textContent = input;
      return el.innerHTML;
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
    },
    // http://stackoverflow.com/a/5658925/1139682 by Adam
    simulateClick: function(elId) {
        var evt;
        var el = (typeof elId === 'string' ? document.getElementById(elId) : elId);
        if (document.createEvent) {
            evt = document.createEvent("MouseEvents");
            evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        }
        (evt) ? el.dispatchEvent(evt) : (el.click && el.click());
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
  TpApp.cache['uploadfallback'] = document.getElementById('upload-fallback');
  TpApp.cache['notifwrap'] = document.getElementById('notifications-wrap');
  TpApp.cache['notifcnt'] = document.getElementById('notifications-cnt');

  if (!Helpers.detection.hasFileAPI()) {
    TpApp.cache['body'].classList.add('no-FileAPI');
  }

  TpApp.traditionalUpload.init();


  // Drag and drop
  document.addEventListener("dragenter", TpApp.dnd.handleEnter, false);
  document.addEventListener("dragleave", TpApp.dnd.handleLeave, false);
  document.addEventListener("dragover", TpApp.dnd.handleOver, false);
  TpApp.cache['dropzone']
          .addEventListener("dragover", TpApp.dnd.handleOver, false);
  TpApp.cache['dropzone']
          .addEventListener('drop', TpApp.dnd.handleDrop, false);

});
