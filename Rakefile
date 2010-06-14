require 'rake'
require 'rubygems'
require 'json'

puts "---"


@version = `git describe`.match("v([0-9]+\.[0-9]+.\[0-9]+).*")[1]

def to_node_json(obj)
  obj = obj.to_json
  # reformat it a bit
  obj.gsub!(/\"\}\]|\[\{|\}\,|\:\{|\:\[[^\{]|\{\"|\,\"|\:\{\"|\"\:|\"\}$/) {|s|
    case s
    when ",\"";     "\n, \""
    when "{\"";     "{ \""
    when ":{";      ":\n  {"
    when ":[";      ": [\n"
    when "},";      "}\n, "
    when "[{";      "[{ "
    when "\"}]";    "\" }]"
    when "\":";     "\": "
    when "\"}";     "\"\n}"
    else;           s
    end
  }
  # finally clean up arrays.
  obj.gsub!(/(.+\[.+)\n\,/, '\1,').gsub(/\}$/, "\n}")
end

desc "Release a new version to various places."
task :release => ['write:pkgspec', 'npm:publish'] do
  puts "Released!"
  puts ""
end

namespace :write do
  desc "Write the package.json file"
  task :pkgspec do
    package = {
      :name => "websocket-server",
      :version => @version,
      :author => "Micheil Smith <micheil@brandedcode.com>",
      :description => "A WebSocket Server for node.js, 90-100% spec compatible.",
      :main => "./lib/ws",
      :engines => { :node => ">=0.1.98-0" },
      :licenses => [{ :type => "MIT", :url => "./LICENSE.md" }],
      :repository => {
        :type => "git",
        :url => "http://github.com/miksago/node-websocket-server.git"
      },
      :bugs => {
        :web => "http://github.com/miksago/node-websocket-server/issues"
      }
    }

    puts "Making package.json"
    f = File.new("package.json", "w+")
    f.write(to_node_json(package))
    f.close
    puts "-> Done"
  end
end

namespace :npm do
  desc "Publish to NPM"
  task :publish do
    puts "Publishing to NPM"
    system("npm publish #{`pwd`}")
    system("npm tag websocket-server #{@version} latest")
    puts "-> Done"
  end
end