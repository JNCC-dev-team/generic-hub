/* 
 *  Copyright (C) 2011 Atlas of Living Australia
 *  All Rights Reserved.
 *
 *  The contents of this file are subject to the Mozilla Public
 *  License Version 1.1 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of
 *  the License at http://www.mozilla.org/MPL/
 *
 *  Software distributed under the License is distributed on an "AS
 *  IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 *  implied. See the License for the specific language governing
 *  rights and limitations under the License.
 */

// Jquery Document.onLoad equivalent
$(document).ready(function() {
    // listeners for sort & paging widgets
    $("select#sort").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('sort',val);
    });
    $("select#dir").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('dir',val);
    });
    $("select#sort").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('sort',val);
    });
    $("select#dir").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('dir',val);
    });
    $("select#per-page").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('pageSize',val);
    });

    // download link
    $("#downloadLink, #alertsLink, #downloadMapLink").fancybox({
        'hideOnContentClick' : false,
        'hideOnOverlayClick': true,
        'showCloseButton': true,
        'titleShow' : false,
        'autoDimensions' : false,
        'width': '500',
        'height': '500',
        'padding': 10,
        'margin': 10,
        onCleanup: function() {
            $("label[for='reasonTypeId']").css("color","#444");
        }
    });

    // Jquery Tools Tabs setup
    var tabsInit = {
        map: false,
        charts: false,
        images: false,
        species: false
    };

    // work-around for intitialIndex & history being mutually exclusive
    if (BC_CONF.defaultListView && !window.location.hash) {
        window.location.hash = BC_CONF.defaultListView; // used for avh, etc
    }

    // initialise BS tabs
    $('a[data-toggle="tab"]').on('shown', function(e) {
        //console.log("this", $(this).attr('id'));
        var id = $(this).attr('id');
        location.hash = 'tab_'+ $(e.target).attr('href').substr(1);

        if (id == "t2" && !tabsInit.map) {
            initialiseMap();
            tabsInit.map = true; // only initialise once!
        } else if (id == "t3" && !tabsInit.charts) {
            // trigger charts load
            loadAllCharts();
            tabsInit.charts = true; // only initialise once!
        } else if (id == "t4" && !tabsInit.species) {
            loadSpeciesInTab(0, "common");
            tabsInit.species = true;
        } else if (id == "t5" && !tabsInit.images && BC_CONF.hasMultimedia) {
            loadImagesInTab();
            tabsInit.images = true;
        }
    });

    // catch hash URIs and trigger tabs
    if (location.hash !== '') {
        $('.nav-tabs a[href="' + location.hash.replace('tab_','') + '"]').tab('show');
        //$('.nav-tabs li a[href="' + location.hash.replace('tab_','') + '"]').click();
    } else {
        $('.nav-tabs a:first').tab('show');
    }

    // Substitute LSID strings for tacon names in facet values for species
    var guidList = [];
    $("li.species_guid, li.genus_guid").each(function(i, el) {
        guidList[i] = $(el).attr("id");
    });

    if (guidList.length > 0) {
        // AJAX call to get names for LSIDs
        // IE7< has limit of 2000 chars on URL so split into 2 requests
        var guidListA = guidList.slice(0, 15) // first 15 elements
        var jsonUrlA = BC_CONF.bieWebappUrl + "/species/namesFromGuids.json?guid=" + guidListA.join("&guid=") + "&callback=?";
        $.getJSON(jsonUrlA, function(data) {
            // set the name in place of LSID
            $("li.species_guid, li.genus_guid").each(function(i, el) {
                if (i < 15) {
                    $(el).find("a").html("<i>"+data[i]+"</i>");
                } else {
                    return false; // breaks each loop
                }
            });
        });

        if (guidList.length > 15) {
            var guidListB = guidList.slice(15)
            var jsonUrlB = BC_CONF.bieWebappUrl + "/species/namesFromGuids.json?guid=" + guidListB.join("&guid=") + "&callback=?";
            $.getJSON(jsonUrlB, function(data) {
                // set the name in place of LSID
                $("li.species_guid, li.genus_guid").each(function(i, el) {
                    // skip forst 15 elements
                    if (i > 14) {
                        var k = i - 15;
                        $(el).find("a").html("<i>"+data[k]+"</i>");
                    }
                });
            });
        }
    }

    // do the same for the selected facet
    var selectedLsid = $("b.species_guid").attr("id");
    if (selectedLsid) {
        var jsonUrl2 = BC_CONF.bieWebappUrl + "/species/namesFromGuids.json?guid=" + selectedLsid + "&callback=?";
        $.getJSON(jsonUrl2, function(data) {
            // set the name in place of LSID
            $("b.species_guid").html("<i>"+data[0]+"</i>");
        });
    }

    // remove *:* query from search bar
    var q = $.getQueryParam('q');
    if (q && q[0] == "*:*") {
        $(":input#solrQuery").val("");
    }

    // bootstrap dropdowns - allow clicking inside dropdown div
    $('#facetCheckboxes').children().not('#updateFacetOptions').click(function(e) {
        //console.log("detected a Click");
        e.stopPropagation();
    });

    // in mobile view toggle display of facets
    $("#toggleFacetDisplay").click(function() {
        $(this).find("i").toggleClass("icon-chevron-down icon-chevron-right");
        if ($(".sidebar").is(":visible")) {
            $(".sidebar").removeClass("overrideHide");
        } else {
            $(".sidebar").addClass("overrideHide");
        }
    });

    // user selectable facets...
    $(":input#updateFacetOptions").live("click",function(e) {
        e.preventDefault();
        //alert("about to reload with new facets...");
        var selectedFacets = [];
        // iterate over seleted facet options
        $(":input.facetOpts:checked").each(function(i, el) {
            selectedFacets.push($(el).val());
        });

        //Check user has selected at least 1 facet
        if (selectedFacets.length > 0) {
            // save facets to the user_facets cookie
            $.cookie("user_facets", selectedFacets, { expires: 7 });
            // reload page
            document.location.reload(true);
        } else {
            alert("Please select at least 1 filter category to display");
        }

    });

    // load stored prefs from cookie
    var userFacets = $.cookie("user_facets");
    if (userFacets) {
        $(":input.facetOpts").removeAttr("checked");
        var facetList = userFacets.split(",");
        for (i in facetList) {
            if (typeof facetList[i] === "string") {
                var thisFacet = facetList[i];
                //console.log("thisFacet", thisFacet);
                $(":input.facetOpts[value='"+thisFacet+"']").attr("checked","checked");
            }
        }
    } //  note removed else that did page refresh by triggering cookie update code.

    // select all and none buttons
    $("a#selectNone").click(function(e) {
        e.preventDefault();
        $(":input.facetOpts").removeAttr("checked");
    });
    $("a#selectAll").click(function(e) {
        e.preventDefault();
        $(":input.facetOpts").attr("checked","checked");
    });

    // taxa search - show included synonyms with popup to allow user to refine to a single name
    $("span.lsid").each(function(i, el) {
        var lsid = $(this).attr("id");
        var nameString = $(this).html();
        var maxFacets = 20;
        var index = i; // keep a copy
        var queryContextParam = (BC_CONF.queryContext) ? "&qc=" + BC_CONF.queryContext : "";
        var jsonUri = BC_CONF.biocacheServiceUrl + "/occurrences/search.json?q=lsid:" + lsid + "&" + BC_CONF.facetQueries +
            "&facets=raw_taxon_name&pageSize=0&flimit=" + maxFacets + queryContextParam + "&callback=?";

        var $clone = $('#resultsReturned #template').clone();
        $clone.attr("id",""); // remove the ID
        $clone.find(".taxaMenuContent").addClass("stopProp");
        // add unique IDs to some elements
        $clone.find("form.raw_taxon_search").attr("id","rawTaxonSearch_" + i);
        $clone.find(":input.rawTaxonSumbit").attr("id","rawTaxonSumbit_" + i);
        $clone.find('.refineTaxaSearch').attr("id", "refineTaxaSearch_" + i);

        $.getJSON(jsonUri, function(data) {
            // list of synonyms
//            var synList = "<div class='refineTaxaSearch' id='refineTaxaSearch_"+i+"'>" +
//                //"<form name='raw_taxon_search' class='rawTaxonSearch' id='rawTaxonSearch_"+i+"' action='" +
//                // BC_CONF.contextPath + "/occurrences/search' method='POST'>" +
//                "These results include records for synonyms and names of child taxa of <b>" + nameString +
//                "</b> (<a href='" + BC_CONF.bieWebappUrl + "/species/" + lsid + "' title='Species page' target='BIE'>" +
//                "view species page</a>).<br/><br/>The result set contains records " +
//                "provided under the following names: <input type='submit' class='rawTaxonSumbit btn btn-small' id='rawTaxonSumbit_"+i+
//                "' value='Search with selected verbatim names' style='display:inline-block;float:right;font-size:12px;'/>" +
//                "<div class='rawTaxaList'>";

            // use HTML template, see http://stackoverflow.com/a/1091493/249327
            var speciesPageUri = BC_CONF.bieWebappUrl + "/species/" + lsid;
            var speciesPageLink = "<a href='" + speciesPageUri + "' title='Species page' target='BIE'>view species page</a>";
            $clone.find('a.btn').text(nameString).attr("href", speciesPageUri);
            $clone.find('.nameString').text(nameString);
            $clone.find('.speciesPageLink').html(speciesPageLink);

            var synListSize = 0;
            var synList1 = "";
            $.each(data.facetResults, function(k, el) {
                //console.log("el", el);
                if (el.fieldName == "raw_taxon_name") {
                    $.each(el.fieldResult, function(j, el1) {
                        synListSize++;
                        synList1 += "<input type='checkbox' name='raw_taxon_guid' id='rawTaxon_" + index + "_" + j +
                            "' class='rawTaxonCheckBox' value='" + el1.label + "'/>&nbsp;" +
                            "<a href='" + BC_CONF.contextPath + "/occurrences/search?q=raw_taxon_name:%22" + el1.label +
                            "%22'>" + el1.label + "</a> (" + el1.count + ")<br/>";
                    });

                }
            });

            if (synListSize == 0) {
                synList1 += "[no records found]";
            }

            //synList1 += "</div>";

            if (synListSize >= maxFacets) {
                synList1 += "<div><br>Only showing the first " + maxFacets + " names<br>See the \"Scientific name (unprocessed)\" section in the \"Refine results\" column on the left for a complete list</div>";
            }

//            synList += "</div>";

            $clone.find('div.rawTaxaList').html(synList1);
            $clone.removeClass("hide");
            // prevent BS dropdown from closing when clicking on content
            $clone.find('.stopProp').children().not('input.rawTaxonSumbit').click(function(e) {
                e.stopPropagation();
            });

//            $("#rawTaxonSearchForm").append(synList);
            // position it under the drop down
//            $("#refineTaxaSearch_"+i).position({
//                my: "right top",
//                at: "right bottom",
//                of: $(el), // or this
//                offset: "0 -1",
//                collision: "none"
//            });
//            $("#refineTaxaSearch_"+i).hide();
        });
        // format display with drop-down
        //$("span.lsid").before("<span class='plain'> which matched: </span>");
//        $(el).html("<a href='#' title='click for details about this taxon search' id='lsid_" + i + "'>" + nameString + "</a>");
//        $(el).addClass("dropDown");
        $(el).html($clone);
    });

    // form validation for raw_taxon_name popup div with checkboxes
    $(":input.rawTaxonSumbit").on("click", function(e) {
        e.preventDefault();
        var submitId = $(this).attr("id");
        var formNum = submitId.replace("rawTaxonSumbit_",""); // 1, 2, etc
        var checkedFound = false;

        $("#refineTaxaSearch_" + formNum).find(":input.rawTaxonCheckBox").each(function(i, el) {
            if ($(el).is(':checked')) {
                checkedFound = true;
                return false; // break loop
            }
        });

        if (checkedFound) {
            //$("form#rawTaxonSearchForm").submit();
            var form  = this.form
            $(form).submit();
        } else {
            alert("Please check at least one \"verbatim scientific name\" checkbox.");
        }
    });

//    $(".queryDisplay a").click(function(e) {
//        e.preventDefault();
//        var j = $(this).attr("id").replace("lsid_", "");
//        $("#refineTaxaSearch_"+j).toggle();
//    });

    // close drop-down divs when clicked outside
//    $('#customiseFacets > a, #refineTaxaSearch, .queryDisplay a, #facetOptions').live("mouseover mouseout", function(event) {
//        if ( event.type == "mouseover" ) {
//            hoverDropDownDiv = true;
//        } else {
//            hoverDropDownDiv = false;
//        }
//    });

    // Hide taxonConcept popup div if clicked outside popup
//    $("body").mouseup(function(e) {
//        var target = $(e.target);
//        if (!hoverDropDownDiv && target.parents(".refineTaxaSearch").length == 0) {
//            $('.refineTaxaSearch, #facetOptions').hide();
//        }
//    });

    // load more images button
    $("#loadMoreImages").live("click", function(e) {
        e.preventDefault();
        var start = $("#imagesGrid").data('count');
        //console.log("start", start);
        loadImages(start);
    });

    // load more species images button
    $("#loadMoreSpecies").live("click", function(e) {
        e.preventDefault();
        var start = $("#speciesGallery").data('count');
        var group = $("#speciesGroup :selected").val();
        var sort = $("#speciesGallery").data('sort');
        //console.log("start", start);
        loadSpeciesInTab(start, sort, group);
    });

    // species tab -> species group drop down
    $("#speciesGroup, #speciesGallerySort").live("change", function(e) {
        var group = $("#speciesGroup :selected").val();
        var sort = $("#speciesGallerySort :selected").val();
        loadSpeciesInTab(0, sort, group);
    });

    // add click even on each record row in results list
    $(".recordRow").click(function(e) {
        e.preventDefault();
        window.location.href = BC_CONF.contextPath + "/occurrence/" + $(this).attr("id");
    }).hover(function(){
            // mouse in
            $(this).css('cursor','pointer');
            $(this).css('background-color','#FFF');
        }, function(){
            // mouse out
            $(this).css('cursor','default');
            $(this).css('background-color','transparent');
        });

    // fancybox div for refining search with multiple facet values
    $(".multipleFacetsLink").fancybox({
        'hideOnContentClick' : false,
        'hideOnOverlayClick': true,
        'showCloseButton': true,
        'titleShow' : false,
        'transitionIn': 'elastic',
        'transitionOut': 'elastic',
        'speedIn': 400,
        'speedOut': 400,
        'scrolling': 'auto',
        'centerOnScroll': true,
        'autoDimensions' : false,
        'width': 560,
        'height': 560,
        'padding': 10,
        'margin': 10,
        onCleanup: function() {
            // clear the div#dynamic html
            $("#dynamic").html("");
        },
        onComplete: function(links) {
            var link = links[0];
            // substitute some facet names so sorting works
            var facetName = link.id.replace("multi-","").replace("_guid","").replace("_uid","_name").replace("data_resource_name",
                "data_resource").replace("data_provider_name","data_provider").replace("occurrence_year","decade").replace(/(_[id])$/,"$1_RNG");
            var displayName = $(link).data("displayname");
            loadMultiFacets(facetName, displayName, null);
        }
    });

    // form validation for form#facetRefineForm
    $("#submitFacets :input.submit").live("click", function(e) {
        e.preventDefault();
        var inverseModifier = ($(this).attr('id') == 'exclude') ? "-" : "";
        var fq = ""; // build up OR'ed fq query
        var facetName = $("table#fullFacets").data("facet");
        var checkedFound = false;
        var selectedCount = 0;
        var maxSelected = 15;
        $("form#facetRefineForm").find(":input.fqs").each(function(i, el) {
            //console.log("checking ", el);
            if ($(el).is(':checked')) {
                checkedFound = true;
                selectedCount++;
                fq += $(el).val() + " OR ";
                //return false; // break loop
            }
        });
        fq = fq.replace(/ OR $/, ""); // remove trailing OR

        if (fq.indexOf(' OR ') != -1) {
            fq = "(" + fq + ")"; // so that exclude (inverse) searches work
        }

        if (facetName == "species_guid" && false) {
            // TODO: remove once service is fixed for this
            alert("Searching with multiple species is temporarily unavailable due to a technical issue. This should be fixed soon.");
        } else if (checkedFound && selectedCount > maxSelected) {
            alert("Too many options selected - maximum is " + maxSelected + ", you have selected " + selectedCount + ", please de-select " +
                (selectedCount - maxSelected) + " options");
        } else if (checkedFound) {
            //$("form#facetRefineForm").submit();
            var hash = window.location.hash;
            var fqString = "&fq=" + inverseModifier + fq;
            window.location.href = window.location.pathname + BC_CONF.searchString + fqString + hash;
        } else {
            alert("Please select at least one checkbox.");
        }
    });

    // QTip generated tooltips
    if($.fn.qtip.plugins.iOS) { return false; }

    $("a.multipleFacetsLink, a#downloadLink, a#alertsLink, .tooltips, .tooltip, span.dropDown a, div#customiseFacets > a, a.removeLink, .btn, .rawTaxonSumbit").qtip({
        style: {
            classes: 'ui-tooltip-rounded ui-tooltip-shadow'
        },
        position: {
            target: 'mouse',
            adjust: { x: 6, y: 14 }
        }
    });

    // maultiple facets popup - sortable column heading links
    $("a.fsort").live("click", function(e) {
        e.preventDefault();
        var fsort = $(this).data('sort');
        var foffset = $(this).data('foffset');
        var table = $(this).closest('table');
        if (table.length == 0) {
            //console.log("table 1", table);
            table = $(this).parent().siblings('table#fullFacets');
        }
        //console.log("table 2", table);
        var facetName = $(table).data('facet');
        var displayName = $(table).data('label');
        //loadMultiFacets(facetName, displayName, criteria, foffset);
        loadFacetsContent(facetName, fsort, foffset, BC_CONF.facetLimit, true);
    });

    // loadMoreValues (legacy - now handled by inview)
    $("a.loadMoreValues").live("click", function(e) {
        e.preventDefault();
        var link = $(this);
        var fsort = link.data('sort');
        var foffset = link.data('foffset');
        var table = $("table#fullFacets");
        //console.log("table 2", table);
        var facetName = $(table).data('facet');
        var displayName = $(table).data('label');
        //loadMultiFacets(facetName, displayName, criteria, foffset);
        loadFacetsContent(facetName, fsort, foffset, BC_CONF.facetLimit, false);
    });

    // Inview trigger to load more values when tr comes into view
    $("tr#loadMore").live("inview", function() {
        var link = $(this).find("a.loadMoreValues");
        //console.log("inview", link);
        var fsort = link.data('sort');
        var foffset = link.data('foffset');
        var table = $("table#fullFacets");
        //console.log("table 2", table);
        var facetName = $(table).data('facet');
        var displayName = $(table).data('label');
        //loadMultiFacets(facetName, displayName, criteria, foffset);
        loadFacetsContent(facetName, fsort, foffset, BC_CONF.facetLimit, false);
    });

    // Email alert buttons
    var alertsUrlPrefix = "http://alerts.ala.org.au/ws/";
    $("a#alertNewRecords, a#alertNewAnnotations").click(function(e) {
        e.preventDefault();
        var query = $("<p>"+BC_CONF.queryString+"</p>").text(); // strips <span> from string
        var fqueries = [];
        var fqtext = $("span.activeFq").each(function() { fqueries.push($(this).text()); });
        if (fqtext) {
            var fqueryString = fqueries.join("; ");
            if(fqueryString.length > 0){
                query += " (" + fqueryString + ")"; // append the fq queries to queryString
            }
        }
        //console.log("fqueries",fqueries, query);
        var methodName = $(this).data("method");
        var url = alertsUrlPrefix + methodName + "?";
        url += "queryDisplayName="+encodeURIComponent(query);
        url += "&baseUrlForWS=" + encodeURIComponent(BC_CONF.biocacheServiceUrl.replace(/\/ws$/,""));
        url += "&baseUrlForUI=" + encodeURIComponent(BC_CONF.serverName);
        url += "&webserviceQuery=%2Fws%2Foccurrences%2Fsearch" + encodeURIComponent(BC_CONF.searchString);
        url += "&uiQuery=%2Foccurrences%2Fsearch%3Fq%3D*%3A*";
        url += "&resourceName=" + encodeURIComponent(BC_CONF.resourceName);
        //console.log("url", query, methodName, url);
        window.location.href = url;
    });

    /**
     * Load Spring i18n messages into JS
     */
    jQuery.i18n.properties({
        name:'Messages',
        path: BC_CONF.contextPath + '/proxy/i18n/',
        mode:'map',
        //language:'en',
        callback: function(){} //alert( "facet.conservationStatus = " + jQuery.i18n.prop('facet.conservationStatus')); }
    });

}); // end JQuery document ready

/**
 * Catch sort drop-down and build GET URL manually
 */
function reloadWithParam(paramName, paramValue) {
    var paramList = [];
    var q = $.getQueryParam('q'); //$.query.get('q')[0];
    var fqList = $.getQueryParam('fq'); //$.query.get('fq');
    var sort = $.getQueryParam('sort');
    var dir = $.getQueryParam('dir');
    var lat = $.getQueryParam('lat');
    var lon = $.getQueryParam('lon');
    var rad = $.getQueryParam('radius');
    var taxa = $.getQueryParam('taxa');
    // add query param
    if (q != null) {
        paramList.push("q=" + q);
    }
    // add filter query param
    if (fqList != null) {
        paramList.push("fq=" + fqList.join("&fq="));
    }
    // add sort param if already set
    if (paramName != 'sort' && sort != null) {
        paramList.push('sort' + "=" + sort);
    }

    if (paramName != null && paramValue != null) {
        paramList.push(paramName + "=" +paramValue);
    }
    
    if (lat && lon && rad) {
        paramList.push("lat=" + lat);
        paramList.push("lon=" + lon);
        paramList.push("radius=" + rad);
    }
    
    if (taxa) {
        paramList.push("taxa=" + taxa);
    }

    //alert("params = "+paramList.join("&"));
    //alert("url = "+window.location.pathname);
    window.location.href = window.location.pathname + '?' + paramList.join('&');
}

/**
 * triggered when user removes an active facet - re-calculates the request params for
 * page minus the requested fq param
 */
function removeFacet(el) {
    var facet = $(el).data("facet");
    var q = $.getQueryParam('q'); //$.query.get('q')[0];
    var fqList = $.getQueryParam('fq'); //$.query.get('fq');
    var lat = $.getQueryParam('lat');
    var lon = $.getQueryParam('lon');
    var rad = $.getQueryParam('radius');
    var taxa = $.getQueryParam('taxa');
    var paramList = [];
    if (q != null) {
        paramList.push("q=" + q);
    }
    
    if (lat && lon && rad) {
        paramList.push("lat=" + lat);
        paramList.push("lon=" + lon);
        paramList.push("radius=" + rad);
    }
    
    if (taxa) {
        paramList.push("taxa=" + taxa);
    }

    //alert("this.facet = "+facet+"; fqList = "+fqList.join('|'));

    if (fqList instanceof Array) {
        //alert("fqList is an array");
        for (var i in fqList) {
            var thisFq = decodeURIComponent(fqList[i]); //.replace(':[',':'); // for dates to work
            //alert("fq = "+thisFq + " || facet = "+decodeURIComponent(facet));
            if (thisFq.indexOf(decodeURIComponent(facet)) != -1) {  // if(str1.indexOf(str2) != -1){
                //alert("removing fq: "+fqList[i]);
                fqList.splice($.inArray(fqList[i], fqList), 1);
            }
        }
    } else {
        //alert("fqList is NOT an array");
        if (decodeURIComponent(fqList) == facet) {
            fqList = null;
        }
    }
    //alert("(post) fqList = "+fqList.join('|'));
    if (fqList != null) {
        paramList.push("fq=" + fqList.join("&fq="));
    }

    window.location.href = window.location.pathname + '?' + paramList.join('&') + window.location.hash;
}

/**
 * Load all the charts 
 */
function loadAllCharts() {

    //console.log("Loading charts.....");
    var bgcolour = "#fffef7"; // was "#F0F0E8"

    var queryString = BC_CONF.searchString.replace("?q=","");
    var biocacheServiceUrl = BC_CONF.biocacheServiceUrl; //BC_CONF.biocacheServiceUrl, // "http://ala-macropus.it.csiro.au/biocache-service";
    
    var taxonomyChartOptions = {
        query: queryString,
        backgroundColor: bgcolour,
        biocacheServicesUrl: biocacheServiceUrl,
        displayRecordsUrl: BC_CONF.serverName
    };
    
    var facetChartOptions = {
        query: queryString,
        charts: ['collection_uid','state','species_group','assertions','type_status','ibra','state_conservation','month','occurrence_year'],
        collection_uid: {title: 'By collection', backgroundColor: bgcolour},
        state: {title: 'By state or territory', backgroundColor: bgcolour},
        species_group: {backgroundColor: bgcolour, title: 'By higher-level groups', ignore: ['Animals','Insects','Crustaceans','Angiosperms','Plants']},
        assertions: {backgroundColor: bgcolour},
        type_status: {backgroundColor: bgcolour},
        ibra: {title: 'By IBRA region', backgroundColor: bgcolour},
        state_conservation: {backgroundColor: bgcolour},
        occurrence_year:{backgroundColor: bgcolour},
        Unknown_s:{backgroundColor: bgcolour},
        month:{backgroundColor: bgcolour},
        biocacheServicesUrl: biocacheServiceUrl,
        displayRecordsUrl: BC_CONF.serverName
    };

    if(dynamicFacets !== undefined){
        //add the dynamic charts.....
        for(var i = 0; i < dynamicFacets.length; i++){
           facetChartOptions.query = facetChartOptions.query + "&facets=" + dynamicFacets[i];
           facetChartOptions.charts.push(dynamicFacets[i]);
           facetChartOptions[dynamicFacets[i]] = {backgroundColor: bgcolour};
           //defaultChartTypes[dynamicFacets[i]] = 'bar';
           var chartTitle = dynamicFacets[i].substring(0,dynamicFacets[i].length - 2).replace('_', ' ');
           chartLabels[dynamicFacets[i]] = chartTitle;
           baseFacetChart.individualChartOptions[dynamicFacets[i]] = { title: chartTitle, facets: [dynamicFacets[i]]}
        }
    }

   // baseFacetChart.individualChartOptions.Unknown_s = { title: 'Unknown_s', facets: ['Unknown_s']};
   // defaultChartTypes.Unknown_s = 'bar';
   // chartLabels.Unknown_s = 'Unknown';

    taxonomyChart.load(taxonomyChartOptions);
    loadFacetCharts(facetChartOptions);
}

/**
 * Load images in images tab
 */
function loadImagesInTab() {
    loadImages(0);
}

function loadImages(start) {
    start = (start) ? start : 0;
    var imagesJsonUri = BC_CONF.biocacheServiceUrl + "/occurrences/search.json" + BC_CONF.searchString + 
        "&fq=multimedia:Image&facet=false&pageSize=20&start=" + start + "&sort=first_loaded_date&dir=desc&callback=?";
    $.getJSON(imagesJsonUri, function(data) {
        //console.log("data",data);
        if (data.occurrences) {
            //var htmlUl = "";
            if (start == 0) {
                $("#imagesGrid").html("");
            }
            var count = 0;
            $.each(data.occurrences, function(i, el) {
                //console.log("el", el.image);
                var imgSrc = el.smallImageUrl;
                count++;
                var imgEl = $("<img src='" + imgSrc +
                    "' style='height: 100px; cursor: pointer;'/>");
                var metaData = {
                    type: 'record',
                    uuid: el.uuid,
                    rank: el.taxonRank,
                    rankId: el.taxonRankID,
                    sciName: el.raw_scientificName,
                    commonName: (el.raw_vernacularName) ? "| " + el.raw_vernacularName : "",
                    date: new Date(el.eventDate * 1000),
                    basisOfRecord: el.basisOfRecord
                };
                imgEl.data(metaData);
                //htmlUl += htmlLi;
                $("#imagesGrid").append(imgEl);
                
            });
            
            if (count + start < data.totalRecords) {
                //console.log("load more", count, start, count + start, data.totalRecords);
                $('#imagesGrid').data('count', count + start);
                $("#loadMoreImages").show();
            } else {
                $("#loadMoreImages").hide();
            }
            
            $('#imagesGrid img').ibox(); // enable hover effect
        }
    });
}

/**
 * Load the species tab with list of species from the current query.
 * Uses automatic scrolling to load new bunch of rows when user scrolls.
 *
 * @param start
 */
function loadSpeciesInTab(start, sortField, group) {
    var pageSize = 20;
    var init = $('#speciesGallery').data('init');
    start = (start) ? start : 0;
    group = (group) ? group : "ALL_SPECIES";
    // sortField should be one of: taxa, common, count
    var sortExtras;
    switch (sortField) {
        case 'taxa': sortExtras = "&common=false&sort=index";
            break;
        default:
        case 'common': sortExtras = "&common=true&sort=index";
            break;
        case 'count': sortExtras = "&common=false&sort=count";
            break;
    }

    if (!init) {
        // populate the groups dropdown
        var groupsUrl = BC_CONF.biocacheServiceUrl + "/explore/groups.json" + BC_CONF.searchString + "&facets=species_group&callback=?";
        $.getJSON(groupsUrl, function(data) {
            if (data.length > 0) {
                $("#speciesGroup").empty();
                $.each(data, function(i, el) {
                    if (el.count > 0) {
                        var indent = Array(el.level + 1).join("-") + " ";
                        var dispayName = el.name.replace("_", " ");
                        if (el.level == 0) {
                            dispayName = dispayName.toLowerCase(); // lowercase
                            dispayName = dispayName.charAt(0).toUpperCase() + dispayName.slice(1); // capitalise first letter
                        }
                        var opt = $("<option value='" + el.name + "'>" + indent + dispayName + " (" + el.speciesCount + ")</option>");
                        $("#speciesGroup").append(opt);
                    }
                });
            }
        }).error(function(){ $("#speciesGroup option").val("Error: species groups were not loaded");});
        //
        $('#speciesGallery').data('init', true);
    } else {
        //$("#loadMoreSpecies").hide();
    }

    if (start == 0) {
        $("#speciesGallery").empty().before("<div id='loadingSpecies'>Loading... <img src='" + BC_CONF.contextPath + "/static/images/indicator.gif'/></div>");
        $("#loadMoreSpecies").hide();
    } else {
        $("#loadMoreSpecies img").show();
    }

    var speciesJsonUrl = BC_CONF.contextPath + "/proxy/exploreGroupWithGallery" + BC_CONF.searchString +
            "&group=" + group + "&pageSize=" + pageSize + "&start=" + start + sortExtras;

    $.getJSON(speciesJsonUrl, function(data) {
        //console.log("data", data);
        if (data.length > 0) {
            //var html = "<table><thead><tr><th>Image</th><th>Scientific name</th><th>Common name</th><th>Record count</th></tr></thead><tbody>";
            var count = 0;
            $.each(data, function(i, el) {
                // don't show higher taxa
                count++;
                if (el.rankId > 6000 && el.thumbnailUrl) {
                    var imgEl = $("<img src='" + el.thumbnailUrl +
                        "' style='height:100px; cursor:pointer;'/>");
                    var metaData = {
                        type: 'species',
                        guid: el.guid,
                        rank: el.rank,
                        rankId: el.rankId,
                        sciName: el.scientificName,
                        commonName: el.commonName,
                        count: el.count
                    };
                    imgEl.data(metaData);
                    $("#speciesGallery").append(imgEl);
                }
            });

            if (count == pageSize) {
                //console.log("load more", count, start, count + start, data.totalRecords);
                $('#speciesGallery').data('count', count + start);
                $("#loadMoreSpecies").show();
            } else {
                $("#loadMoreSpecies").hide();
            }

            $('#speciesGallery img').ibox(); // enable hover effect

            //html += "</tbody></table>";
//            $("#speciesGallery").append(html);

        }
    }).error(function (request, status, error) {
            alert(request.responseText);
    }).complete(function() {
            $("#loadingSpecies").remove();
            $("#loadMoreSpecies img").hide();
    });
}

/**
 * iBox Jquery plugin for Google Images hover effect.
 * Origina by roxon http://stackoverflow.com/users/383904/roxon
 * Posted to stack overflow: 
 *   http://stackoverflow.com/questions/7411393/pop-images-like-google-images/7412302#7412302
 */
(function($) {
    $.fn.ibox = function() {
        // set zoom ratio //
        resize = 50; // pixels to add to img height
        ////////////////////
        var img = this;
        img.parent().parent().parent().append('<div id="ibox" />');
        $('body').append('<div id="ibox" />');
        var ibox = $('#ibox');
        var elX = 0;
        var elY = 0;

        img.each(function() {
            var el = $(this);

            el.mouseenter(function() {
                ibox.html('');
                var elH = el.height();
                var elW = el.width();
                var ratio = elW / elH; //(elW > elH) ? elW / elH : elH / elW;
                var newH = elH + resize;
                var newW = newH * ratio;
                var offset = (((newW - elW) / 2) + 6);
                //console.log(ratio, elW, newW, offset);
                elX = el.position().left - offset ; // 6 = CSS#ibox padding+border
                elY = el.position().top - 6;
                var h = el.height();
                var w = el.width();
                var wh;
                checkwh = (h < w) ? (wh = (w / h * resize) / 2) : (wh = (w * resize / h) / 2);

                $(this).clone().prependTo(ibox);

                var link, rank, linkTitle, count;
                var md = $(el).data();

                if (md.type == 'species') {
                    link = BC_CONF.bieWebappUrl + "/species/"  + md.guid;
                    linkTitle = "Go to ALA species page";
                    rank = " ";
                    count = " <br/>Record count: " + md.count;
                } else {
                    link = BC_CONF.contextPath + "/occurrences/"  + md.uuid;
                    linkTitle = "Go to occurrence record";
                    rank = "<span style='text-transform: capitalize'>" + md.rank + "</span>: ";
                    count = "";
                }

                var itals = (md.rankId >= 6000) ? "<span style='font-style: italic;'>" : "<span>";
                var infoDiv = "<div style=''><a href='" + link + "' title='" + linkTitle + "'>" + rank + itals +
                    md.sciName + "</span><br/>" + md.commonName.replace("| ", "") + "</a> " + count + "</div>";
                $(ibox).append(infoDiv);
                $(ibox).click(function(e) {
                    e.preventDefault();
                    window.location.href = link;
                });
                
                ibox.css({
                    top: elY + 'px',
                    left: elX + 'px',
                    "max-width": $(el).width() + (2 * wh) + 12
                });

                ibox.stop().fadeTo(200, 1, function() {
                    //$(this).animate({top: '-='+(resize/2), left:'-='+wh},200).children('img').animate({height:'+='+resize},200);
                    $(this).children('img').animate({height:'+='+resize},200);
                });
                
            });

            ibox.mouseleave(function() {
                ibox.html('').hide();
            });
        });
    };
})(jQuery);

// vars for hiding drop-dpwn divs on click outside tem
var hoverDropDownDiv = false;

/**
 * draws the div for selecting multiple facets (popup div)
 */
function loadMultiFacets(facetName, displayName, fsort, foffset) {
    foffset = (foffset) ? foffset : "0";
    var facetLimit = BC_CONF.facetLimit;
    //$("#dynamic").html("Loading...");
    var facet = facetName; //(facetName == "occurrence_year") ? "year" : facetName; // Date facets have different name
    //console.log("loadMultiFacets", facetName,  displayName, fsort);
    // pull params out of BC_CONF.searchString
    var params = BC_CONF.searchString.replace(/^\?/, "").split("&");
    var inputsHtml = "";
    $.each(params, function(i, el) {
        var pair = el.split("=");
        if (pair.length == 2) {
            inputsHtml += "<input type='hidden' name='" + pair[0] + "' value='" + pair[1] + "'/>";
        }
    });
    // draw the table and buttons
    //$("#dynamic").html(""); // reset div
    var html = "<form name='facetRefineForm' id='facetRefineForm' method='GET' action='" +
                BC_CONF.contextPath + "/occurrences/search/facets'>";
    html += inputsHtml ;// add existing params
    html += "<table class='compact scrollTable' id='fullFacets' data-facet='" + facet + "' data-label='" + displayName + "'>";
    html += "<thead class='fixedHeader'><tr class='tableHead'><th>&nbsp;</th><th id='indexCol'><a href='#index' class='fsort' data-sort='index' data-foffset='0' title='Sort by " + displayName + "'>" + displayName + "</a></th>";
    html += "<th><a href='#count' class='fsort' data-sort='count' data-foffset='0' title='Sort by record count'>Count</a></th></tr></thead>";
    html += "<tbody class='scrollContent'><tr id='loadingRow'><td colspan='3'>Loading... <img src='" + BC_CONF.contextPath + "/static/images/loading.gif' alt='loading'/></td></tr></tbody>";
    //html += "<tfoot><tr id='submitFacets'><td colspan='3'><input type='submit' class='submit'/></form></td></tr></tfoot>"; // empty row that gets loaded via AJAX
    html += "</table></form>";
    //html += "<input type='submit' class='submit'/></form>";
    $("div#dynamic").append(html);
    $("a.fsort").qtip({
        style: {
            classes: 'ui-tooltip-rounded ui-tooltip-shadow'
        },
        position: {
            target: 'mouse',
            adjust: {
                x: 8, y: 12
            }
        }
    });
    // perform ajax
    loadFacetsContent(facet, fsort, foffset, facetLimit);
}

function loadFacetsContent(facetName, fsort, foffset, facetLimit, replaceFacets) {
    var jsonUri = BC_CONF.contextPath + "/occurrences/facet/values.json" + BC_CONF.searchString +
        "&facets=" + facetName + "&flimit=" + facetLimit + "&foffset=" + foffset; // + "&fsort=" + fsort

    if (fsort) {
        // so default facet sorting is used in initial loading
        jsonUri += "&fsort=" + fsort;
    }

    $.getJSON(jsonUri, function(data) {
        //console.log("data",data);

        if (data.length > 0) {
            var hasMoreFacets = false;
            var html = "";
            $("tr#loadingRow").remove(); // remove the loading message
            $("tr#loadMore").remove(); // remove the load more records link
            if (replaceFacets) {
                // remove any facet values in table
                $("table#fullFacets tr").not("tr.tableHead").remove();
            }
            $.each(data, function(i, el) {
                if (el.count > 0) {
                    // surround with quotes: fq value if contains spaces but not for range queries
                    var fqEsc = ((el.label.indexOf(" ") != -1 || el.label.indexOf("lsid") != -1) && el.label.indexOf("[") != 0)
                        ? "\"" + el.label + "\""
                        : el.label; // .replace(/:/g,"\\:")
                    var label = el.displayLabel;
                    if (label.indexOf("@") != -1) {
                        label = label.substring(0,label.indexOf("@"));
                    } else if (jQuery.i18n.prop(label).indexOf("[") == -1) {
                        // i18n substitution
                        label = jQuery.i18n.prop(label);
                    } else if (facetName.indexOf("outlier_layer") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("layer." + label);
                    } else if (facetName.indexOf("geospatial_kosher") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("geospatial_kosher." + label);
                    } else if (facetName.indexOf("user_assertions") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("user_assertions." + label);
                    } else if (facetName.indexOf("duplicate_type") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("duplication." + label);
                    } else if (facetName.indexOf("taxonomic_issue") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop(label);
                    }
                    facetName = facetName.replace(/_RNG$/,""); // remove range version if present
//                    console.log("label", label, facetName, el);
                    var fqParam = (el.fq) ? encodeURIComponent(el.fq) : facetName.replace("decade","occurrence_year") + ":" + encodeURIComponent(fqEsc);
                    //var link = BC_CONF.searchString.replace("'", "&apos;") + "&fq=" + fqParam;
                    
                    //NC: 2013-01-16 I changed the link so that the search string is uri encoded so that " characters do not cause issues 
                    //Problematic URL http://biocache.ala.org.au/occurrences/search?q=lsid:urn:lsid:biodiversity.org.au:afd.taxon:b76f8dcf-fabd-4e48-939c-fd3cafc1887a&fq=geospatial_kosher:true&fq=state:%22Australian%20Capital%20Territory%22
                    var link = encodeURI(BC_CONF.searchString) + "&fq=" + fqParam;
                    //console.log(link)
                    var rowType = (i % 2 == 0) ? "normalRow" : "alternateRow";
                    html += "<tr class='" + rowType + "'><td>" +
                        "<input type='checkbox' name='fqs' class='fqs' value='"  + fqParam +
                        "'/></td><td><a href=\"" + link + "\"> " + label + "</a></td><td style='text-align: right'>" + el.count + "</td></tr>";
                }
                if (i == facetLimit - 1) {
                    //console.log("got to end of page of facets: " + i);
                    hasMoreFacets = true;
                }
            });
            $("table#fullFacets tbody").append(html);
            // Fix some border issues
            $("table#fullFacets tr:last td").css("border-bottom", "1px solid #CCCCCC");
            $("table#fullFacets td:last-child, table#fullFacets th:last-child").css("border-right", "none");
            //$("tr.hidden").fadeIn('slow');

            if (hasMoreFacets) {
                var offsetInt = Number(foffset);
                var flimitInt = Number(facetLimit);
                var loadMore =  "<tr id='loadMore' class=''><td colspan='3'><a href='#index' class='loadMoreValues' data-sort='" +
                    fsort + "' data-foffset='" + (offsetInt + flimitInt) +
                    "'>Loading " + facetLimit + " more values...</a></td></tr>";
                $("table#fullFacets tbody").append(loadMore);
                //$("tr#loadMore").fadeIn('slow');
            }

            var tableHeight = $("#fullFacets tbody").height();
            var tbodyHeight = 0;
            $("#fullFacets tbody tr").each(function(i, el) {
                tbodyHeight += $(el).height();
            });
            //console.log("table heights", tableHeight, tbodyHeight);
            if (false && tbodyHeight < tableHeight) {
                // no scroll bar so adjust column widths
                var thWidth = $(".scrollContent td + td + td").width() + 18; //$("th#indexCol").width() + 36;
                $(".scrollContent td + td + td").width(thWidth);

            }
            //$.fancybox.resize();
        } else {
            $("tr#loadingRow").remove(); // remove the loading message
            $("tr#loadMore").remove(); // remove the load more records link
            $("table#fullFacets tbody").append("<tr><td></td><td>[Error: no values returned]</td></tr>");
        }
    });
}